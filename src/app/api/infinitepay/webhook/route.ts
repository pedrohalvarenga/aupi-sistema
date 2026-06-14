import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook da InfinitePay (Checkout). Chamado quando um pagamento é confirmado.
 * Valida a cobrança pelo order_nsu + valor e ativa a empresa por 30 dias.
 * Deve responder 200 {"success": true} em menos de 1 segundo.
 */
export async function POST(request: Request) {
  // Autenticação fail-closed: o checkout ativo é o Asaas; esta rota (InfinitePay)
  // é legado. Só processa se INFINITEPAY_WEBHOOK_TOKEN estiver configurado E o
  // token vier correto na URL (?token=) ou no header. Impede forjar pagamento.
  const token = process.env.INFINITEPAY_WEBHOOK_TOKEN
  const recebido = new URL(request.url).searchParams.get('token')
    || request.headers.get('x-webhook-token')
  if (!token || recebido !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

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

  const admin = createAdminClient()

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
