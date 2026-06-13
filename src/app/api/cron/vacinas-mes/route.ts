import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { addDays, parseISO, format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const VACINA_VALIDADE_DIAS = 365

// Cron mensal: envia para CADA empresa o relatório de vacinas vencendo,
// no e-mail de contato dela e com a marca dela.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: empresas } = await adminClient
    .from('empresas')
    .select('id, nome, cor_primaria, email_contato')
    .in('status', ['trial', 'ativo', 'inadimplente'])
    .not('email_contato', 'is', null)

  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)
  const mesAno = format(hoje, 'MMMM yyyy', { locale: ptBR })

  const camposVacina = [
    { campo: 'vacina_v8_v10', label: 'V8/V10' },
    { campo: 'vacina_antirabica', label: 'Antirrábica' },
    { campo: 'vacina_gripe', label: 'Gripe' },
    { campo: 'vacina_giardia', label: 'Giardia' },
  ]

  type VacinaInfo = { pet: string; tutor: string; vacina: string; vencimento: string; status: 'vencida' | 'vence_este_mes' }
  const resultados: { empresa: string; alertas: number; enviado: boolean }[] = []

  for (const empresa of empresas ?? []) {
    const { data: pets } = await adminClient
      .from('pets')
      .select('*, tutor:tutores(nome, telefone)')
      .eq('empresa_id', empresa.id)
      .eq('ativo', true)

    const alertas: VacinaInfo[] = []
    for (const pet of pets ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = pet as any
      for (const { campo, label } of camposVacina) {
        if (!p[campo]) continue
        const dose = parseISO(p[campo])
        const vencimento = addDays(dose, VACINA_VALIDADE_DIAS)
        const vencida = vencimento < hoje
        const vencenteEsteMes = vencimento >= inicioMes && vencimento <= fimMes
        if (vencida || vencenteEsteMes) {
          alertas.push({
            pet: p.nome,
            tutor: p.tutor?.nome ?? '—',
            vacina: label,
            vencimento: format(vencimento, 'dd/MM/yyyy', { locale: ptBR }),
            status: vencida ? 'vencida' : 'vence_este_mes',
          })
        }
      }
    }

    if (alertas.length === 0) {
      resultados.push({ empresa: empresa.nome, alertas: 0, enviado: false })
      continue
    }

    const linhas = alertas.map(a => `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 12px;font-weight:600;">${a.pet}</td>
        <td style="padding:10px 12px;color:#666;">${a.tutor}</td>
        <td style="padding:10px 12px;">${a.vacina}</td>
        <td style="padding:10px 12px;">${a.vencimento}</td>
        <td style="padding:10px 12px;">
          <span style="background:${a.status === 'vencida' ? '#fee2e2' : '#fef9c3'};color:${a.status === 'vencida' ? '#b91c1c' : '#854d0e'};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600;">
            ${a.status === 'vencida' ? '🔴 Vencida' : '🟡 Vence este mês'}
          </span>
        </td>
      </tr>`).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:${empresa.cor_primaria};padding:28px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">🐾 ${empresa.nome}</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Relatório de vacinas — ${mesAno}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;margin:0 0 20px;">Olá! Seguem os cães com vacinas <strong>vencidas ou que vencem em ${mesAno}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Pet</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Tutor</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Vacina</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Vencimento</th>
            <th style="padding:10px 12px;text-align:left;color:#6b7280;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
        Total: ${alertas.length} vacina(s) a tratar. Relatório enviado automaticamente no dia 1 de cada mês.
      </p>
    </div>
  </div>
</body>
</html>`

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Aupi <noreply@aupipet.com.br>',
      to: empresa.email_contato!,
      subject: `🐾 Vacinas do mês — ${mesAno} | ${empresa.nome}`,
      html,
    })

    resultados.push({ empresa: empresa.nome, alertas: alertas.length, enviado: !emailError })
  }

  return NextResponse.json({ ok: true, resultados })
}
