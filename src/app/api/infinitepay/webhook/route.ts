import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Webhook da InfinitePay (Checkout). Chamado quando um pagamento é confirmado.
 * Valida a cobrança pelo order_nsu + valor e ativa a empresa por 30 dias.
 * Deve responder 200 {"success": true} em menos de 1 segundo.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* ignora corpo inválido */ }

  const orderNsu = String(body.order_nsu ?? '')
  // valor pago vem em centavos (paid_amount ou amount)
  const pago = Number(body.paid_amount ?? body.amount ?? 0)
  const receiptUrl = body.receipt_url ? String(body.receipt_url) : null

  // forma de pagamento (define a carência de bloqueio)
  const capture = String(body.capture_method ?? '').toLowerCase()
  const formaPagamento = capture.includes('credit') || capture.includes('card') || capture.includes('cart')
    ? 'cartao'
    : capture.includes('boleto') ? 'boleto'
    : capture.includes('pix') ? 'pix'
    : null

  if (!orderNsu) return NextResponse.json({ success: true }) // nada a fazer

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: cobranca } = await admin
    .from('assinaturas_cobrancas')
    .select('id, empresa_id, plano, valor_centavos, status')
    .eq('order_nsu', orderNsu)
    .single()

  // Cobrança inexistente, já paga, ou valor divergente → ignora com 200 (não reprocessa)
  if (!cobranca || cobranca.status === 'paga' || pago < cobranca.valor_centavos) {
    return NextResponse.json({ success: true })
  }

  // Marca como paga
  await admin.from('assinaturas_cobrancas')
    .update({ status: 'paga', receipt_url: receiptUrl, paid_at: new Date().toISOString() })
    .eq('id', cobranca.id)

  // Ativa a empresa por 30 dias e aplica o plano + forma de pagamento
  const ate = new Date(); ate.setDate(ate.getDate() + 30)
  await admin.from('empresas').update({
    status: 'ativo',
    plano: cobranca.plano,
    trial_ate: ate.toISOString().split('T')[0],
    ...(formaPagamento ? { forma_pagamento: formaPagamento } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', cobranca.empresa_id)

  return NextResponse.json({ success: true })
}
