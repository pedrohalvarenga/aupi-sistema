import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularComissaoFuncionario } from '@/lib/comissoes.server'
import type { ComissaoMesFuncionario } from '@/types/funcionarios'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const empresaId = profile.empresa_id as string

  const { searchParams } = new URL(request.url)
  const mes = Number(searchParams.get('mes'))
  const ano = Number(searchParams.get('ano'))
  if (!mes || mes < 1 || mes > 12 || !ano) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: funcionarios } = await admin.from('funcionarios')
    .select('id, nome_completo, cargo, foto_url, salario')
    .eq('empresa_id', empresaId)
    .eq('recebe_comissao', true)
    .eq('ativo', true)
    .order('nome_completo')

  const { data: pagas } = await admin.from('comissoes_pagas')
    .select('funcionario_id')
    .eq('empresa_id', empresaId)
    .eq('competencia_mes', mes).eq('competencia_ano', ano)
  const pagosSet = new Set(((pagas as { funcionario_id: string }[]) ?? []).map(p => p.funcionario_id))

  const lista: ComissaoMesFuncionario[] = []
  for (const f of (funcionarios as { id: string; nome_completo: string; cargo: string | null; foto_url: string | null; salario: number }[]) ?? []) {
    const { total } = await calcularComissaoFuncionario(empresaId, f.id, ano, mes)
    lista.push({
      funcionario: { id: f.id, nome_completo: f.nome_completo, cargo: f.cargo, foto_url: f.foto_url, salario: f.salario },
      total,
      pago: pagosSet.has(f.id),
    })
  }

  const totalGeral = Math.round(lista.reduce((s, l) => s + l.total, 0) * 100) / 100
  return NextResponse.json({ lista, totalGeral })
}
