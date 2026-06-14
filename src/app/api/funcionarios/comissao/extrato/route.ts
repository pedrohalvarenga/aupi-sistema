import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularComissaoFuncionario } from '@/lib/comissoes.server'

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
  const funcionarioId = searchParams.get('funcionario_id') || ''
  const mes = Number(searchParams.get('mes'))
  const ano = Number(searchParams.get('ano'))
  if (!funcionarioId || !mes || mes < 1 || mes > 12 || !ano) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: func } = await admin.from('funcionarios')
    .select('id, nome_completo, cargo, salario, empresa_id')
    .eq('id', funcionarioId).single()
  if (!func || func.empresa_id !== empresaId) {
    return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
  }

  const { linhas, total } = await calcularComissaoFuncionario(empresaId, funcionarioId, ano, mes)

  return NextResponse.json({
    funcionario: { id: func.id, nome_completo: func.nome_completo, cargo: func.cargo, salario: func.salario },
    linhas, total, mes, ano,
  })
}
