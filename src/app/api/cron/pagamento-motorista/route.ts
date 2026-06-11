import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron semanal (segunda-feira): gera o lançamento pendente do pagamento
// do motorista para CADA empresa com módulo de transporte ativo.
// Valor editável em config_transporte (chave pagamento_motorista_valor).
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, nome')
    .eq('mod_transporte', true)
    .in('status', ['trial', 'ativo', 'inadimplente'])

  const hoje = new Date().toISOString().split('T')[0]
  const descricao = `Pagamento motorista — semana de ${hoje.split('-').reverse().join('/')}`
  const resultados: { empresa: string; gerada: boolean; motivo?: string }[] = []

  for (const empresa of empresas ?? []) {
    const { data: config } = await supabase
      .from('config_transporte')
      .select('valor')
      .eq('empresa_id', empresa.id)
      .eq('chave', 'pagamento_motorista_valor')
      .maybeSingle()

    const valor = parseFloat(config?.valor ?? '')
    if (isNaN(valor) || valor <= 0) {
      resultados.push({ empresa: empresa.nome, gerada: false, motivo: 'valor não configurado' })
      continue
    }

    const { data: existe } = await supabase
      .from('despesas')
      .select('id')
      .eq('empresa_id', empresa.id)
      .eq('area', 'transporte')
      .eq('categoria', 'salarios')
      .eq('data_vencimento', hoje)
      .limit(1)

    if (existe && existe.length > 0) {
      resultados.push({ empresa: empresa.nome, gerada: false, motivo: 'já existe' })
      continue
    }

    const { error } = await supabase.from('despesas').insert({
      empresa_id: empresa.id,
      data: hoje,
      data_vencimento: hoje,
      valor,
      area: 'transporte',
      categoria: 'salarios',
      descricao,
      status: 'pendente',
      recorrente: false,
    })
    resultados.push({ empresa: empresa.nome, gerada: !error, motivo: error?.message })
  }

  return NextResponse.json({ ok: true, resultados })
}
