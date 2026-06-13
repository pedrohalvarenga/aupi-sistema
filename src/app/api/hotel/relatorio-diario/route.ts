import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

interface EmpresaInfo { id: string; nome: string; cidade: string | null; cor_primaria: string; cor_secundaria: string }

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { data: dataParam } = await req.json().catch(() => ({}))
    const data: string = dataParam ?? new Date().toISOString().split('T')[0]

    const isCron = req.headers.get('x-cron-secret') === process.env.CRON_SECRET && !!process.env.CRON_SECRET

    if (isCron) {
      // Cron: envia o relatório de CADA empresa com hotel ativo
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: empresas } = await admin
        .from('empresas')
        .select('id, nome, cidade, cor_primaria, cor_secundaria')
        .eq('mod_hotel', true)
        .in('status', ['trial', 'ativo', 'inadimplente'])

      const resultados = []
      for (const empresa of (empresas ?? []) as EmpresaInfo[]) {
        const r = await gerarEEnviar(admin, empresa, data, resend)
        resultados.push({ empresa: empresa.nome, ...r })
      }
      return NextResponse.json({ ok: true, resultados })
    }

    // Chamada manual pelo app: a sessão (RLS) já escopa a empresa do usuário
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, nome, cidade, cor_primaria, cor_secundaria')
      .limit(1)
      .single<EmpresaInfo>()
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })

    const r = await gerarEEnviar(supabase, empresa, data, resend)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gerarEEnviar(supabase: any, empresa: EmpresaInfo, data: string, resend: Resend) {
    // Buscar emails configurados
    const { data: cfgEmails } = await supabase
      .from('config_hotel')
      .select('valor')
      .eq('empresa_id', empresa.id)
      .eq('chave', 'emails_relatorio')
      .maybeSingle()

    const emails = (cfgEmails?.valor ?? '')
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean)

    if (emails.length === 0) {
      return { error: 'Nenhum e-mail configurado. Vá em Configurações → Hotel e adicione os e-mails.' }
    }

    // Buscar dados do dia
    const [{ data: hospList }, { data: escala }] = await Promise.all([
      supabase
        .from('hospedagens')
        .select('*, pet:pets(nome, porte, tutor:tutores(nome, telefone))')
        .eq('empresa_id', empresa.id)
        .not('status', 'in', '(cancelada)')
        .order('checkin_previsto'),
      supabase
        .from('escala_plantao')
        .select('*, plantonista:plantonistas(nome, telefone)')
        .eq('empresa_id', empresa.id)
        .eq('data', data)
        .maybeSingle(),
    ])

    const lista = hospList ?? []

    const entradas = lista.filter((h: { checkin_real?: string; checkin_previsto: string }) => {
      const ci = new Date(h.checkin_real ?? h.checkin_previsto).toISOString().split('T')[0]
      return ci === data
    })
    const saidas = lista.filter((h: { checkout_real?: string; checkout_previsto: string }) => {
      const co = new Date(h.checkout_real ?? h.checkout_previsto).toISOString().split('T')[0]
      return co === data
    })
    const hospedados = lista.filter((h: { checkin_previsto: string; checkout_previsto: string }) => {
      const ci = new Date(h.checkin_previsto).toISOString().split('T')[0]
      const co = new Date(h.checkout_previsto).toISOString().split('T')[0]
      return ci <= data && co > data
    })

    const totalSaidas = saidas.reduce((acc: number, h: { valor_total?: number }) => acc + (h.valor_total ?? 0), 0)
    const plantonista = (escala as { plantonista?: { nome?: string; telefone?: string } } | null)?.plantonista

    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const html = buildHtmlRelatorio({ empresa, data: dataFmt, entradas, saidas, hospedados, totalSaidas, plantonista })

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Aupi <noreply@aupipet.com.br>',
      to: emails,
      subject: `${empresa.nome} — Relatório Hotel ${data}`,
      html,
    })

    return { enviado: !emailError, error: emailError?.message }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHtmlRelatorio({ empresa, data, entradas, saidas, hospedados, totalSaidas, plantonista }: any) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">${label}</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">${value}</td></tr>`

  const petRows = (list: { pet?: { nome?: string; tutor?: { nome?: string } }; checkin_real?: string; checkin_previsto?: string; checkout_real?: string; checkout_previsto?: string; valor_total?: number }[], tipo: 'entrada' | 'saida' | 'hospedado') =>
    list.map(h => {
      const nome = h.pet?.nome ?? '—'
      const tutor = h.pet?.tutor?.nome ?? ''
      let hora = ''
      if (tipo === 'entrada') hora = new Date(h.checkin_real ?? h.checkin_previsto ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      if (tipo === 'saida') hora = new Date(h.checkout_real ?? h.checkout_previsto ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const valor = tipo === 'saida' && h.valor_total ? `<br/><strong style="color:${empresa.cor_primaria}">R$ ${h.valor_total.toFixed(2).replace('.', ',')}</strong>` : ''
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;">🐾 <strong>${nome}</strong><br/><span style="color:#999;font-size:12px;">${tutor}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;">${hora}${valor}</td>
      </tr>`
    }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:${empresa.cor_primaria};padding:28px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">${empresa.nome.toUpperCase()}</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Hotel — Relatório Diário</p>
    <p style="margin:4px 0 0;color:#fff;font-size:15px;font-weight:600;">${data}</p>
  </div>

  <!-- Resumo -->
  <div style="display:flex;gap:0;border-bottom:2px solid #f0f0f0;">
    <div style="flex:1;padding:16px;text-align:center;border-right:1px solid #f0f0f0;">
      <p style="margin:0;font-size:26px;font-weight:900;color:#2563eb;">${entradas.length}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#999;">Entradas</p>
    </div>
    <div style="flex:1;padding:16px;text-align:center;border-right:1px solid #f0f0f0;">
      <p style="margin:0;font-size:26px;font-weight:900;color:${empresa.cor_primaria};">${hospedados.length}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#999;">Hospedados</p>
    </div>
    <div style="flex:1;padding:16px;text-align:center;">
      <p style="margin:0;font-size:26px;font-weight:900;color:${empresa.cor_secundaria};">${saidas.length}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#999;">Saídas</p>
    </div>
  </div>

  <div style="padding:24px;">
    ${entradas.length > 0 ? `
    <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;">Entradas do dia</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${petRows(entradas, 'entrada')}</table>` : ''}

    ${hospedados.length > 0 ? `
    <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;">Hospedados esta noite</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">${petRows(hospedados, 'hospedado')}</table>` : ''}

    ${saidas.length > 0 ? `
    <h3 style="margin:0 0 8px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;">Saídas do dia</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${petRows(saidas, 'saida')}</table>
    ${totalSaidas > 0 ? `<div style="text-align:right;padding:8px 0;border-top:2px solid ${empresa.cor_primaria};font-weight:700;color:${empresa.cor_primaria};font-size:16px;">Total: R$ ${totalSaidas.toFixed(2).replace('.', ',')}</div>` : ''}
    <div style="margin-bottom:20px;"></div>` : ''}

    <!-- Plantonista -->
    <div style="background:#eef2ff;border-radius:12px;padding:16px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">🌙 Plantonista da noite</p>
      ${plantonista
        ? `<p style="margin:0;font-size:16px;font-weight:700;color:#1e1b4b;">${plantonista.nome}</p>${plantonista.telefone ? `<p style="margin:4px 0 0;font-size:13px;color:#666;">${plantonista.telefone}</p>` : ''}`
        : `<p style="margin:0;font-size:15px;font-weight:700;color:#ef4444;">⚠️ Nenhum plantonista escalado</p>`
      }
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9f9f9;padding:16px 24px;text-align:center;border-top:1px solid #f0f0f0;">
    <p style="margin:0;font-size:11px;color:#ccc;">Relatório gerado automaticamente por ${empresa.nome}${empresa.cidade ? ' • ' + empresa.cidade : ''}</p>
  </div>
</div>
</body></html>`
}
