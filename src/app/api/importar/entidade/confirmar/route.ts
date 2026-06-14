import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEmpresa } from '@/lib/empresa'
import { ENTIDADES, ehTipoEntidade, type Registro } from '@/lib/importar-entidades'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const empresa = await getEmpresa()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  let body: { tipo?: string; registros?: Registro[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!ehTipoEntidade(body.tipo)) return NextResponse.json({ error: 'Tipo de importação inválido.' }, { status: 400 })
  const config = ENTIDADES[body.tipo]
  const registros = (body.registros ?? []).filter(r => r && typeof r === 'object')
  if (registros.length === 0) return NextResponse.json({ error: 'Nada para importar.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const eid = empresa.id

  // ---- Chaves já existentes no banco (para não duplicar) ----
  const existentes = new Set<string>()
  if (config.tipo === 'funcionarios') {
    const { data } = await admin.from('funcionarios').select('cpf, nome_completo').eq('empresa_id', eid)
    for (const r of data ?? []) existentes.add(config.chave(r))
  } else if (config.tipo === 'fornecedores') {
    const { data } = await admin.from('fornecedores').select('cnpj, nome').eq('empresa_id', eid)
    for (const r of data ?? []) existentes.add(config.chave(r))
  } else if (config.tipo === 'financeiro') {
    const [rec, desp] = await Promise.all([
      admin.from('receitas').select('data, valor, descricao').eq('empresa_id', eid),
      admin.from('despesas').select('data, valor, descricao').eq('empresa_id', eid),
    ])
    for (const r of rec.data ?? []) existentes.add(config.chave(r))
    for (const r of desp.data ?? []) existentes.add(config.chave(r))
  }

  // ---- Monta inserts agrupados por tabela, pulando duplicados ----
  const porTabela: Record<string, Record<string, unknown>[]> = {}
  let ignorados = 0
  for (const r of registros) {
    const k = config.chave(r)
    if (existentes.has(k)) { ignorados++; continue }
    existentes.add(k)
    const built = config.paraInsert(r, eid)
    if (!built) { ignorados++; continue }
    ;(porTabela[built.tabela] ??= []).push(built.row)
  }

  let criados = 0
  for (const [tabela, rows] of Object.entries(porTabela)) {
    if (rows.length === 0) continue
    const { data, error } = await admin.from(tabela).insert(rows).select('id')
    if (error) {
      console.error(`Erro ao inserir em ${tabela}:`, error)
      return NextResponse.json({
        error: `Falha ao salvar ${config.plural}: ${error.message}`,
        criados,
      }, { status: 500 })
    }
    criados += data?.length ?? 0
  }

  return NextResponse.json({ ok: true, criados, ignorados })
}
