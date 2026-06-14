import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularComissaoFuncionario } from '@/lib/comissoes.server'
import { MESES_LABELS } from '@/types/funcionarios'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  const empresaId = profile.empresa_id as string

  let body: { funcionario_id?: string; mes?: number; ano?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 }) }

  const funcionarioId = body.funcionario_id
  const mes = Number(body.mes)
  const ano = Number(body.ano)
  if (!funcionarioId || !mes || mes < 1 || mes > 12 || !ano) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // Confirma que o funcionário é da empresa do admin (multi-tenant).
    const { data: func } = await admin.from('funcionarios')
      .select('id, nome_completo, empresa_id, recebe_comissao')
      .eq('id', funcionarioId).single()
    if (!func || func.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // Já pago essa competência?
    const { data: jaPago } = await admin.from('comissoes_pagas')
      .select('id').eq('empresa_id', empresaId)
      .eq('funcionario_id', funcionarioId)
      .eq('competencia_mes', mes).eq('competencia_ano', ano).maybeSingle()
    if (jaPago) {
      return NextResponse.json({ error: 'Comissão deste mês já foi paga.' }, { status: 409 })
    }

    // Recalcula no servidor — não confia no cliente.
    const { total } = await calcularComissaoFuncionario(empresaId, funcionarioId, ano, mes)
    if (total <= 0) {
      return NextResponse.json({ error: 'Sem comissão a pagar neste mês.' }, { status: 400 })
    }

    const competencia = `${MESES_LABELS[mes - 1]}/${ano}`
    const dataPagamento = new Date().toISOString().split('T')[0]

    // Despesa: área 'geral' (comissões cruzam várias áreas) + categoria 'comissoes'.
    const { data: despesa, error: errDespesa } = await admin.from('despesas').insert({
      empresa_id: empresaId,
      data: dataPagamento,
      valor: total,
      area: 'geral',
      categoria: 'comissoes',
      status: 'pago',
      descricao: `Comissão ${competencia} — ${func.nome_completo}`,
      registrado_por: user.id,
    }).select('id').single()

    if (errDespesa || !despesa) {
      console.error('pagar comissao - despesa', errDespesa)
      return NextResponse.json({ error: 'Não foi possível registrar a despesa.' }, { status: 400 })
    }

    const { error: errPaga } = await admin.from('comissoes_pagas').insert({
      empresa_id: empresaId,
      funcionario_id: funcionarioId,
      competencia_mes: mes,
      competencia_ano: ano,
      valor_total: total,
      despesa_id: despesa.id,
      criado_por: user.id,
    })

    if (errPaga) {
      // Conflito da UNIQUE = corrida; desfaz a despesa que acabamos de criar.
      await admin.from('despesas').delete().eq('id', despesa.id).eq('empresa_id', empresaId)
      if (errPaga.code === '23505') {
        return NextResponse.json({ error: 'Comissão deste mês já foi paga.' }, { status: 409 })
      }
      console.error('pagar comissao - comissoes_pagas', errPaga)
      return NextResponse.json({ error: 'Não foi possível registrar o pagamento.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, total, despesa_id: despesa.id })
  } catch (e) {
    console.error('pagar comissao - erro', e)
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
