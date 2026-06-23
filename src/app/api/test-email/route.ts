import { NextResponse } from 'next/server'
import { getResend, RESEND_FROM, temResend } from '@/lib/resend'

// ROTA TEMPORÁRIA de verificação do Resend — REMOVER após confirmar.
const TOKEN = 'aupi-resend-check-9f3a'
const PARA = 'pedroalvarengamkt@gmail.com'

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (token !== TOKEN) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 401 })
  }
  if (!temResend) {
    return NextResponse.json({ error: 'RESEND_API_KEY não definida', from: RESEND_FROM }, { status: 500 })
  }
  try {
    const resend = getResend()
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: PARA,
      subject: 'Teste Aupi — Resend OK ✅',
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
        <h2 style="color:#D98232">Resend funcionando ✅</h2>
        <p>Se você recebeu este e-mail, toda a régua automática está apta a enviar.</p>
        <p style="font-size:12px;color:#999">from: ${RESEND_FROM}</p>
      </div>`,
    })
    return NextResponse.json({ ok: !result.error, id: result.data?.id ?? null, error: result.error ?? null, from: RESEND_FROM })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
