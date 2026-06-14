import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getPlanoInfo } from '@/lib/planos'
import { asaasPost, asaasGet, asaasConfigurado } from '@/lib/asaas'

/**
 * Checkout TRANSPARENTE do Asaas — o cliente paga 100% dentro do Aupi,
 * sem nunca ver a página do Asaas nem os dados do dono da plataforma.
 *
 *  - Cartão : tokeniza e cobra na hora (creditCard + creditCardHolderInfo + remoteIp).
 *  - PIX    : devolve o QR Code (imagem) e o copia-e-cola para pagar no app.
 *  - Boleto : devolve a URL do boleto e a linha digitável.
 *
 * A empresa é ativada pelo webhook (/api/asaas/webhook) — e, no cartão,
 * também imediatamente aqui se a 1ª cobrança já vier confirmada.
 */

const soDigitos = (s: unknown) => String(s ?? '').replace(/\D/g, '')

interface Cliente {
  nome?: string
  cpfCnpj?: string
  email?: string
  telefone?: string
  cep?: string
  numero?: string
}
interface Cartao {
  numero?: string
  nome?: string
  validade?: string // "MM/AA" ou "MM/AAAA"
  cvv?: string
}

export async function POST(request: Request) {
  let body: { plano?: string; metodo?: string; cliente?: Cliente; cartao?: Cartao }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }
  const { plano, metodo = 'cartao', cliente = {}, cartao = {} } = body

  if (!asaasConfigurado()) {
    return NextResponse.json({ error: 'Pagamento não configurado (Asaas).' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('empresa_id, role, nome').eq('id', user.id).single()
  if (!profile?.empresa_id) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Apenas o admin pode assinar' }, { status: 403 })

  const info = getPlanoInfo(plano || '')
  if (!info) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

  // ── Validação dos dados do assinante (exigidos pelo Asaas) ──
  const cpfCnpj = soDigitos(cliente.cpfCnpj)
  const cep = soDigitos(cliente.cep)
  const telefone = soDigitos(cliente.telefone)
  const nome = (cliente.nome || '').trim()
  const email = (cliente.email || user.email || '').trim()
  const numero = (cliente.numero || '').trim() || 'S/N'

  if (nome.length < 3) return NextResponse.json({ error: 'Informe o nome completo ou razão social.' }, { status: 400 })
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)
    return NextResponse.json({ error: 'CPF ou CNPJ inválido.' }, { status: 400 })
  if (!email.includes('@')) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  if (cep.length !== 8) return NextResponse.json({ error: 'CEP inválido.' }, { status: 400 })
  if (telefone.length < 10) return NextResponse.json({ error: 'Telefone inválido (com DDD).' }, { status: 400 })

  const { data: empresa } = await supabase
    .from('empresas').select('id, nome, asaas_customer_id, email_contato').eq('id', profile.empresa_id).single()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // 1. Cliente no Asaas — sempre garante CPF/CNPJ e dados atualizados.
    const dadosCliente = {
      name: nome,
      cpfCnpj,
      email,
      mobilePhone: telefone,
      postalCode: cep,
      addressNumber: numero,
    }
    let customerId = empresa.asaas_customer_id as string | null
    if (customerId) {
      // atualiza dados (cliente pode ter sido criado antes sem CPF)
      await asaasPost(`/customers/${customerId}`, dadosCliente).catch(() => {})
    } else {
      const cli = await asaasPost('/customers', dadosCliente)
      customerId = cli.id
      const { error: upErr } = await admin
        .from('empresas').update({ asaas_customer_id: customerId }).eq('id', empresa.id)
      if (upErr) throw new Error('Falha ao salvar cliente: ' + upErr.message)
    }

    // 2. Monta a assinatura recorrente mensal conforme o método.
    const billingType = metodo === 'pix' ? 'PIX' : metodo === 'boleto' ? 'BOLETO' : 'CREDIT_CARD'
    const hoje = new Date().toISOString().split('T')[0]
    const subBody: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value: info.precoCentavos / 100,
      nextDueDate: hoje,
      cycle: 'MONTHLY',
      description: `Aupi — Plano ${info.nome}`,
      externalReference: empresa.id,
    }

    if (billingType === 'CREDIT_CARD') {
      const num = soDigitos(cartao.numero)
      const cvv = soDigitos(cartao.cvv)
      const val = soDigitos(cartao.validade) // MMAA ou MMAAAA
      if (num.length < 13) return NextResponse.json({ error: 'Número do cartão inválido.' }, { status: 400 })
      if (cvv.length < 3) return NextResponse.json({ error: 'CVV inválido.' }, { status: 400 })
      if (val.length !== 4 && val.length !== 6)
        return NextResponse.json({ error: 'Validade inválida (MM/AA).' }, { status: 400 })
      const expiryMonth = val.slice(0, 2)
      const expiryYear = val.length === 4 ? '20' + val.slice(2) : val.slice(2)
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '127.0.0.1'

      subBody.creditCard = {
        holderName: (cartao.nome || nome).trim(),
        number: num,
        expiryMonth,
        expiryYear,
        ccv: cvv,
      }
      subBody.creditCardHolderInfo = {
        name: nome,
        email,
        cpfCnpj,
        postalCode: cep,
        addressNumber: numero,
        phone: telefone,
      }
      subBody.remoteIp = ip
    }

    const sub = await asaasPost('/subscriptions', subBody)
    await admin
      .from('empresas')
      .update({ asaas_subscription_id: sub.id, plano: info.id, forma_pagamento: metodo })
      .eq('id', empresa.id)

    // 3. Recupera a 1ª cobrança gerada pela assinatura.
    const cobr = await asaasGet(`/subscriptions/${sub.id}/payments`)
    const pay = cobr?.data?.[0]
    if (!pay?.id) return NextResponse.json({ error: 'Cobrança não gerada pelo Asaas' }, { status: 502 })

    // 4. Resposta conforme o método — tudo renderizado dentro do Aupi.
    if (billingType === 'CREDIT_CARD') {
      const st = String(pay.status || '').toUpperCase()
      const aprovado = st === 'CONFIRMED' || st === 'RECEIVED' || st === 'RECEIVED_IN_CASH'
      if (aprovado) {
        const ate = new Date(); ate.setDate(ate.getDate() + 30)
        await admin.from('empresas').update({
          status: 'ativo', trial_ate: ate.toISOString().split('T')[0], forma_pagamento: 'cartao',
          updated_at: new Date().toISOString(),
        }).eq('id', empresa.id)
      }
      return NextResponse.json({ tipo: 'cartao', aprovado, status: st })
    }

    if (billingType === 'PIX') {
      const qr = await asaasGet(`/payments/${pay.id}/pixQrCode`)
      return NextResponse.json({
        tipo: 'pix',
        valor: info.precoCentavos / 100,
        pix: { imagem: qr?.encodedImage || null, copiaECola: qr?.payload || null, expira: qr?.expirationDate || null },
      })
    }

    // BOLETO
    let linhaDigitavel: string | null = null
    try {
      const idf = await asaasGet(`/payments/${pay.id}/identificationField`)
      linhaDigitavel = idf?.identificationField || null
    } catch { /* boleto pode levar segundos para gerar a linha */ }
    return NextResponse.json({
      tipo: 'boleto',
      valor: info.precoCentavos / 100,
      boleto: { url: pay.bankSlipUrl || pay.invoiceUrl || null, linhaDigitavel },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro no Asaas' }, { status: 502 })
  }
}
