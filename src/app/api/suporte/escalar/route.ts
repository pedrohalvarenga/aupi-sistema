import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/lib/empresa'
import { hostEmpresa } from '@/lib/dominio'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Para onde vão os pedidos de atendimento humano (configurável; padrão: dono do Aupipet)
const DESTINO = process.env.SUPORTE_EMAIL || 'pedroalvarengamkt@gmail.com'

type Msg = { role: 'user' | 'assistant'; content: string }

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { mensagem?: string; messages?: Msg[]; contato?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }) }

  const conversa = (body.messages ?? []).filter(m => m && typeof m.content === 'string').slice(-30)
  const mensagemDireta = (body.mensagem ?? '').trim()
  if (!mensagemDireta && conversa.length === 0) {
    return NextResponse.json({ error: 'Escreva sua mensagem antes de enviar.' }, { status: 400 })
  }

  const empresa = await getEmpresa()
  const { data: profile } = await supabase.from('profiles').select('nome, email').eq('id', user.id).single<{ nome: string; email: string }>()

  // Monta o texto bruto da conversa
  const transcricao = conversa.map(m => `${m.role === 'user' ? 'Gestor' : 'IA'}: ${m.content}`).join('\n')
  const base = mensagemDireta
    ? `Mensagem do gestor:\n${mensagemDireta}`
    : `Conversa com a IA de suporte:\n${transcricao}`

  // Resumo sucinto e organizado para você ler rápido
  let resumo = mensagemDireta || transcricao
  let assunto = 'Pedido de atendimento'
  try {
    const r = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Você organiza pedidos de suporte para o dono do Aupipet ler rápido. Responda APENAS um JSON válido, sem markdown:
{"assunto":"frase curta de até 8 palavras","resumo":"2-4 linhas objetivas: o que o gestor quer, qual módulo, e a ação sugerida"}`,
      messages: [{ role: 'user', content: base }],
    })
    const txt = r.content[0]?.type === 'text' ? r.content[0].text.replace(/```json|```/g, '').trim() : ''
    const j = JSON.parse(txt)
    if (j.assunto) assunto = String(j.assunto).slice(0, 120)
    if (j.resumo) resumo = String(j.resumo)
  } catch {
    // Se a IA falhar, mandamos o texto cru mesmo — o importante é você receber.
  }

  const empresaNome = empresa?.nome ?? '—'
  const empresaLink = empresa?.slug ? hostEmpresa(empresa.slug) : '—'
  const contato = (body.contato ?? '').trim() || profile?.email || user.email || '—'

  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
    <div style="background:#8A05BE;color:#fff;padding:16px 20px;border-radius:14px 14px 0 0">
      <h2 style="margin:0;font-size:18px">📨 Novo atendimento — ${escapeHtml(assunto)}</h2>
    </div>
    <div style="border:1px solid #eee;border-top:0;padding:20px;border-radius:0 0 14px 14px">
      <table style="font-size:14px;width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 0;color:#6b7280;width:120px">Empresa</td><td style="padding:4px 0"><b>${escapeHtml(empresaNome)}</b></td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Link</td><td style="padding:4px 0">${escapeHtml(empresaLink)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Gestor</td><td style="padding:4px 0">${escapeHtml(profile?.nome ?? '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Contato</td><td style="padding:4px 0">${escapeHtml(contato)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Plano</td><td style="padding:4px 0">${escapeHtml(empresa?.plano ?? '—')}</td></tr>
      </table>
      <h3 style="font-size:14px;margin:18px 0 6px;color:#8A05BE">Resumo</h3>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;margin:0">${escapeHtml(resumo)}</p>
      <h3 style="font-size:14px;margin:18px 0 6px;color:#6b7280">Conteúdo completo</h3>
      <pre style="font-size:12px;line-height:1.5;white-space:pre-wrap;background:#f9fafb;border:1px solid #eee;border-radius:10px;padding:12px;margin:0">${escapeHtml(base)}</pre>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px">Prazo combinado com o gestor: retorno em até 48h.</p>
    </div>
  </div>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // O e-mail de suporte vai sempre para o dono da conta, então usamos o
    // remetente de teste da Resend (onboarding@resend.dev), que funciona SEM
    // domínio verificado. Quando aupipet.com.br for verificado na Resend,
    // basta definir SUPORTE_FROM para enviar com a marca.
    await resend.emails.send({
      from: process.env.SUPORTE_FROM || 'Aupipet Suporte <onboarding@resend.dev>',
      to: DESTINO,
      replyTo: contato.includes('@') ? contato : undefined,
      subject: `[Suporte Aupipet] ${empresaNome} — ${assunto}`,
      html,
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
