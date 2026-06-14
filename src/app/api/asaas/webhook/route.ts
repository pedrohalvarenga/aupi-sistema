import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Webhook do Asaas — cobrança recorrente da plataforma Aupipet.
 *
 * Configurar no painel do Asaas:
 *   URL: https://SEU-DOMINIO/api/asaas/webhook
 *   Token de autenticação: mesmo valor de ASAAS_WEBHOOK_TOKEN no .env
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → empresa fica 'ativo'
 *   PAYMENT_OVERDUE                      → empresa fica 'inadimplente'
 *   SUBSCRIPTION_DELETED                 → empresa fica 'cancelado'
 *
 * O vínculo é feito pelo campo empresas.asaas_customer_id, preenchido
 * quando você cria o cliente no Asaas (manual ou via API).
 */
export async function POST(request: Request) {
  const token = request.headers.get('asaas-access-token')
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const evento = await request.json()
  const tipo: string = evento?.event ?? ''
  const customerId: string | undefined =
    evento?.payment?.customer ?? evento?.subscription?.customer
  // Vínculo primário: externalReference = empresa.id (setado na criação da assinatura).
  const empresaId: string | undefined =
    evento?.payment?.externalReference ?? evento?.subscription?.externalReference

  if (!customerId && !empresaId) return NextResponse.json({ ok: true, ignorado: true })

  // Monta a atualização conforme o evento
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (tipo === 'PAYMENT_CONFIRMED' || tipo === 'PAYMENT_RECEIVED') {
    // Pagamento confirmado → ativa e estende a validade por 30 dias
    const ate = new Date(); ate.setDate(ate.getDate() + 30)
    update.status = 'ativo'
    update.trial_ate = ate.toISOString().split('T')[0]
    const bt = String(evento?.payment?.billingType ?? '').toUpperCase()
    update.forma_pagamento = bt.includes('CREDIT') ? 'cartao' : bt.includes('PIX') ? 'pix' : bt.includes('BOLETO') ? 'boleto' : null
  } else if (tipo === 'PAYMENT_OVERDUE') {
    update.status = 'inadimplente' // a carência em acessoBloqueado cuida do prazo
  } else if (tipo === 'SUBSCRIPTION_DELETED') {
    update.status = 'cancelado'
  } else {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const admin = createAdminClient()

  // Casa a empresa por externalReference (id) quando disponível; senão, pelo customer.
  let casou = false
  if (empresaId) {
    const { data, error } = await admin.from('empresas').update(update).eq('id', empresaId).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    casou = (data?.length ?? 0) > 0
  }
  // Fallback: se o id não casou nada (ou não veio), tenta pelo customer.
  if (!casou && customerId) {
    const { error } = await admin.from('empresas').update(update).eq('asaas_customer_id', customerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
