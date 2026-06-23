import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Cron diário: GET /api/cron/reengajamento  (schedule "0 12 * * *" = 9h BRT)
// Recupera empresas que se cadastraram e NUNCA ativaram (0 pets).
// Dispara e-mail nos dias D+1, D+3 e D+7 após o cadastro, com link direto
// para o passo que falta (/pets/novo). WhatsApp segue manual (superadmin),
// pois não há provedor de envio automático integrado.
const OFFSETS = [1, 3, 7]
const OFFSETS_VENC = [3, 0] // dias ANTES de trial_ate (D-3 e no dia)
const SEED_EMPRESA = '00000000-0000-0000-0000-000000000001' // Play Dog — nunca tocar

function assuntoVenc(dias: number, nome: string): string {
  return dias === 0
    ? `Hoje é o último dia de teste da ${nome}`
    : `Faltam ${dias} dias no teste da ${nome}`
}

function corpoVenc(dias: number, nome: string, primeiroNome: string, url: string): string {
  const intro = dias === 0
    ? 'Seu período de teste termina hoje. Para não perder o acesso nem os dados que você já cadastrou, escolha um plano agora — leva 2 minutos.'
    : `Seu teste termina em ${dias} dias. Você já colocou dados no sistema — assine para manter tudo funcionando sem interrupção.`
  return `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="background:#D98232;padding:28px;">
      <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">Aupi Pet</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">${primeiroNome}, seu teste está acabando</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${intro}</p>
      <a href="${url}/assinar" style="display:block;background:#D98232;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:14px;font-size:15px;font-weight:600;margin-bottom:20px;">
        Escolher meu plano →
      </a>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Seus dados ficam guardados em segurança.<br>
        <a href="${url}" style="color:#D98232;text-decoration:none;">Acessar a ${nome}</a>
      </p>
    </div>
  </div>
</body></html>`
}

function assunto(dia: number, nome: string): string {
  if (dia === 1) return `${nome}, faltou só cadastrar o primeiro pet 🐾`
  if (dia === 3) return `Posso te ajudar a colocar a ${nome} pra rodar?`
  return `Seu teste da ${nome} está correndo — vamos ativar?`
}

function corpo(dia: number, nome: string, primeiroNome: string, url: string): string {
  const intro =
    dia === 1
      ? 'Você criou a conta ontem mas ainda não cadastrou nenhum pet. Em 2 minutos o sistema já fica útil de verdade.'
      : dia === 3
        ? 'Notei que sua conta ainda está vazia. O primeiro pet é o que destrava tudo: agenda, ficha, cobrança e relatórios. O tutor entra no mesmo cadastro e a IA até lê o cartão de vacina por foto.'
        : 'Seu período de teste está correndo e a conta ainda não tem dados. Não deixe o teste passar sem ver o sistema funcionando — comece pelo primeiro pet.'
  return `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="background:#D98232;padding:28px;">
      <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">Aupi Pet</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">Oi, ${primeiroNome}! 👋</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${intro}</p>
      <a href="${url}/pets/novo" style="display:block;background:#D98232;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:14px;font-size:15px;font-weight:600;margin-bottom:20px;">
        Cadastrar primeiro pet →
      </a>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Travou em algo? Responda este e-mail.<br>
        <a href="${url}" style="color:#D98232;text-decoration:none;">Acessar a ${nome}</a>
      </p>
    </div>
  </div>
</body></html>`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY ausente' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  const enviados: { empresa: string; dia: number }[] = []
  const erros: string[] = []

  for (const dia of OFFSETS) {
    // Janela do dia-alvo (created_at == hoje - dia, em UTC)
    const ini = new Date(); ini.setUTCHours(0, 0, 0, 0); ini.setUTCDate(ini.getUTCDate() - dia)
    const fim = new Date(ini); fim.setUTCDate(fim.getUTCDate() + 1)

    const { data: empresas, error } = await admin
      .from('empresas')
      .select('id, nome, slug, status')
      .eq('status', 'trial')
      .neq('id', SEED_EMPRESA)
      .gte('created_at', ini.toISOString())
      .lt('created_at', fim.toISOString())
    if (error) { erros.push(`query D${dia}: ${error.message}`); continue }

    for (const emp of empresas ?? []) {
      // Só reengaja quem NÃO ativou (0 pets)
      const { count } = await admin
        .from('pets').select('id', { count: 'exact', head: true }).eq('empresa_id', emp.id)
      if ((count ?? 0) > 0) continue

      // E-mail do dono (perfil admin → auth.users)
      const { data: prof } = await admin
        .from('profiles').select('id, nome').eq('empresa_id', emp.id).eq('role', 'admin').limit(1).maybeSingle()
      if (!prof) continue
      const { data: u } = await admin.auth.admin.getUserById(prof.id)
      const email = u?.user?.email
      if (!email) continue

      const url = `https://${emp.slug}.app.aupipet.com.br`
      const primeiroNome = (prof.nome || emp.nome || '').split(' ')[0] || 'tudo bem'
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
          to: email,
          subject: assunto(dia, emp.nome),
          html: corpo(dia, emp.nome, primeiroNome, url),
        })
        enviados.push({ empresa: emp.slug, dia })
      } catch (e: unknown) {
        erros.push(`${emp.slug} D${dia}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  // ── Pass 2: aviso de vencimento do trial (D-3 e D0) para quem JÁ ativou ──
  const avisos: { empresa: string; dias: number }[] = []
  for (const dias of OFFSETS_VENC) {
    const alvo = new Date(); alvo.setUTCHours(0, 0, 0, 0); alvo.setUTCDate(alvo.getUTCDate() + dias)
    const alvoStr = alvo.toISOString().split('T')[0]

    const { data: empresas, error } = await admin
      .from('empresas')
      .select('id, nome, slug')
      .eq('status', 'trial')
      .neq('id', SEED_EMPRESA)
      .eq('trial_ate', alvoStr)
    if (error) { erros.push(`venc D-${dias}: ${error.message}`); continue }

    for (const emp of empresas ?? []) {
      // Só avisa quem ativou (tem ao menos 1 pet) — não-ativados recebem o Pass 1
      const { count } = await admin
        .from('pets').select('id', { count: 'exact', head: true }).eq('empresa_id', emp.id)
      if ((count ?? 0) === 0) continue

      const { data: prof } = await admin
        .from('profiles').select('id, nome').eq('empresa_id', emp.id).eq('role', 'admin').limit(1).maybeSingle()
      if (!prof) continue
      const { data: u } = await admin.auth.admin.getUserById(prof.id)
      const email = u?.user?.email
      if (!email) continue

      const url = `https://${emp.slug}.app.aupipet.com.br`
      const primeiroNome = (prof.nome || emp.nome || '').split(' ')[0] || 'tudo bem'
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
          to: email,
          subject: assuntoVenc(dias, emp.nome),
          html: corpoVenc(dias, emp.nome, primeiroNome, url),
        })
        avisos.push({ empresa: emp.slug, dias })
      } catch (e: unknown) {
        erros.push(`venc ${emp.slug} D-${dias}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return NextResponse.json({ ok: true, enviados, avisos, erros })
}
