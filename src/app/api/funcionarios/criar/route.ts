import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TIPOS_VALIDOS = new Set(['banho_tosa', 'hotel', 'creche', 'transporte', 'veterinario', 'geral'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const empresaId = profile.empresa_id as string

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 }) }

  const nome = String(body.nome_completo ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome completo.' }, { status: 400 })

  const admin = createAdminClient()

  try {
    let usuarioId = (body.usuario_id as string | null) || null

    // Opcionalmente cria um usuário do sistema vinculado.
    if (body.criar_usuario && body.email && body.senha) {
      const { data: newUser, error: errAuth } = await admin.auth.admin.createUser({
        email: String(body.email),
        password: String(body.senha),
        email_confirm: true,
        user_metadata: { nome, role: body.role || 'recepcao', empresa_id: empresaId },
      })
      if (errAuth) {
        console.error('criar funcionario - createUser', errAuth)
        return NextResponse.json({ error: 'Não foi possível criar o login.' }, { status: 400 })
      }
      await admin.from('profiles').upsert({
        id: newUser.user.id,
        email: String(body.email),
        nome,
        role: (body.role as string) || 'recepcao',
        empresa_id: empresaId,
        ativo: true,
        permissoes: null,
      })
      usuarioId = newUser.user.id
    }

    const { data: func, error: errFunc } = await admin.from('funcionarios').insert({
      empresa_id: empresaId,
      nome_completo: nome,
      cpf: body.cpf ?? null,
      rg: body.rg ?? null,
      data_nascimento: body.data_nascimento ?? null,
      foto_url: body.foto_url ?? null,
      email: body.email ?? null,
      telefone: body.telefone ?? null,
      cargo: body.cargo ?? null,
      salario: typeof body.salario === 'number' ? body.salario : 0,
      data_admissao: body.data_admissao ?? null,
      tam_calca: body.tam_calca ?? null,
      tam_camisa: body.tam_camisa ?? null,
      tam_sapato: body.tam_sapato ?? null,
      usuario_id: usuarioId,
      recebe_comissao: Boolean(body.recebe_comissao),
      observacoes: body.observacoes ?? null,
    }).select('id').single()

    if (errFunc || !func) {
      console.error('criar funcionario - insert', errFunc)
      return NextResponse.json({ error: 'Não foi possível salvar o funcionário.' }, { status: 400 })
    }

    const regras = Array.isArray(body.regras) ? body.regras : []
    const linhas = regras
      .filter((r): r is { tipo: string; percentual: number } =>
        r && TIPOS_VALIDOS.has(r.tipo) && typeof r.percentual === 'number' && r.percentual > 0)
      .map(r => ({ empresa_id: empresaId, funcionario_id: func.id, tipo: r.tipo, percentual: r.percentual }))

    if (linhas.length) {
      const { error: errRegras } = await admin.from('comissao_regras').insert(linhas)
      if (errRegras) {
        console.error('criar funcionario - regras', errRegras)
        return NextResponse.json({ error: 'Funcionário salvo, mas falhou ao gravar as comissões.' }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, id: func.id })
  } catch (e) {
    console.error('criar funcionario - erro', e)
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
