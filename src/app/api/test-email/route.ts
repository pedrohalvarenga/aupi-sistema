import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// rota temporaria de teste — remover apos verificar
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 401 })
  }

  const to = searchParams.get('to') ?? 'pedroalvarengamkt@gmail.com'

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY não definida' }, { status: 500 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
      to,
      subject: 'Teste Aupi — e-mail de boas-vindas OK ✅',
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
        <h2 style="color:#D98232">E-mail funcionando ✅</h2>
        <p>O Resend está configurado corretamente.<br>
        O e-mail de boas-vindas será enviado automaticamente a cada novo cadastro.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
        <p style="font-size:12px;color:#999">RESEND_FROM: ${process.env.RESEND_FROM ?? '(não definido)'}</p>
      </div>`,
    })
    return NextResponse.json({ ok: true, id: result.data?.id, error: result.error })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
