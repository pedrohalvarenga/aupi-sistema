import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// ROTA TEMPORÁRIA de verificação do Resend — REMOVER após confirmar.
// Token embutido (vida curta) e destinatário fixo, para não permitir abuso.
const TOKEN = 'aupi-resend-check-9f3a'
const PARA = 'pedroalvarengamkt@gmail.com'

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (token !== TOKEN) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY não definida', from: process.env.RESEND_FROM ?? null }, { status: 500 })
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
      to: PARA,
      subject: 'Teste Aupi — Resend OK ✅',
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
        <h2 style="color:#D98232">Resend funcionando ✅</h2>
        <p>Se você recebeu este e-mail, toda a régua automática (boas-vindas, reengajamento, celebração, inatividade, dica semanal e aviso de vencimento) está apta a enviar.</p>
        <p style="font-size:12px;color:#999">from: ${process.env.RESEND_FROM ?? '(default)'}</p>
      </div>`,
    })
    return NextResponse.json({ ok: !result.error, id: result.data?.id ?? null, error: result.error ?? null, from: process.env.RESEND_FROM ?? null })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
