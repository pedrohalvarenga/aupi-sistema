import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getPlanoInfo } from '@/lib/planos'

/**
 * Gera um link de pagamento na InfinitePay (Checkout API) para a assinatura
 * do plano escolhido e registra a cobrança como pendente. O webhook
 * (/api/infinitepay/webhook) ativa a empresa quando o pagamento é confirmado.
 */
export async function POST(request: Request) {
  const { plano } = await request.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('empresa_id, role').eq('id', user.id).single()
  if (!profile?.empresa_id) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Apenas o admin pode assinar' }, { status: 403 })

  // Resolve plano e valor
  const info = getPlanoInfo(plano)
  if (!info) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  const planoId = plano
  const valorCentavos = info.precoCentavos
  const descricao = `Aupi — Plano ${info.nome}`

  const handle = process.env.INFINITEPAY_HANDLE
  if (!handle) return NextResponse.json({ error: 'Pagamento não configurado (handle ausente)' }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.aupipet.com.br'
  const orderNsu = `aupi_${profile.empresa_id}_${Date.now()}`

  // Registra a cobrança como pendente (service role)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error: errCob } = await admin.from('assinaturas_cobrancas').insert({
    empresa_id: profile.empresa_id,
    plano: planoId,
    valor_centavos: valorCentavos,
    order_nsu: orderNsu,
    status: 'pendente',
  })
  if (errCob) return NextResponse.json({ error: 'Erro ao registrar cobrança: ' + errCob.message }, { status: 500 })

  // Cria o link na InfinitePay
  const resp = await fetch('https://api.checkout.infinitepay.io/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      handle,
      order_nsu: orderNsu,
      redirect_url: `${appUrl}/assinar/sucesso`,
      webhook_url: `${appUrl}/api/infinitepay/webhook`,
      items: [{ quantity: 1, price: valorCentavos, description: descricao }],
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text()
    return NextResponse.json({ error: 'InfinitePay recusou: ' + txt.slice(0, 200) }, { status: 502 })
  }

  const data = await resp.json()
  // O retorno traz a URL do checkout (campos possíveis: url / checkout_url / link)
  const url = data.url || data.checkout_url || data.link || data.payment_url
  if (!url) return NextResponse.json({ error: 'Link não retornado pela InfinitePay', raw: data }, { status: 502 })

  return NextResponse.json({ url })
}
