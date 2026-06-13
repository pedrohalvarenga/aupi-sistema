import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Webhook do Asaas — cobrança recorrente da plataforma Aupi.
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

  if (!customerId) return NextResponse.json({ ok: true, ignorado: true })

  let novoStatus: string | null = null
  if (tipo === 'PAYMENT_CONFIRMED' || tipo === 'PAYMENT_RECEIVED') novoStatus = 'ativo'
  else if (tipo === 'PAYMENT_OVERDUE') novoStatus = 'inadimplente'
  else if (tipo === 'SUBSCRIPTION_DELETED') novoStatus = 'cancelado'

  if (!novoStatus) return NextResponse.json({ ok: true, ignorado: true })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('empresas')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq('asaas_customer_id', customerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
