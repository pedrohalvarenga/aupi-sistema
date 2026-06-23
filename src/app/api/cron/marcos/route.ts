import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Cron diário: GET /api/cron/marcos  (schedule "0 13 * * *" = 10h BRT)
// (1) CELEBRAÇÃO: e-mail quando a empresa cruza um marco pela 1ª vez
//     (1º pet / 1ª chamada / 1º pagamento) — flags em empresas evitam repetir.
// (2) INATIVIDADE comportamental: empresa que OPEROU (presença/receita) e ficou
//     fria >= 5 dias recebe um "sentimos sua falta". Re-arma quando ela volta a usar.
const SEED_EMPRESA = '00000000-0000-0000-0000-000000000001'
const DIAS_INATIVO = 5

function emailHTML(faixa: string, titulo: string, corpo: string, ctaLabel: string, ctaUrl: string, url: string, nome: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="background:#D98232;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,.85);font-size:13px;">${faixa}</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:21px;font-weight:700;">${titulo}</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">${corpo}</p>
      <a href="${ctaUrl}" style="display:block;background:#D98232;color:#fff;text-decoration:none;text-align:center;padding:13px 22px;border-radius:14px;font-size:15px;font-weight:600;margin-bottom:14px;">
        ${ctaLabel} →
      </a>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        <a href="${url}/ajuda" style="color:#D98232;text-decoration:none;">Guia de uso</a> · Dúvidas? Responda este e-mail.
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
  const from = process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>'

  const { data: empresas, error } = await admin
    .from('empresas')
    .select('id, nome, slug, marco_pet, marco_presenca, marco_receita, ultimo_aviso_inatividade')
    .in('status', ['trial', 'ativo'])
    .neq('id', SEED_EMPRESA)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const comemorados: string[] = []
  const inativos: string[] = []
  const erros: string[] = []

  for (const emp of empresas ?? []) {
    const url = `https://${emp.slug}.app.aupipet.com.br`

    // e-mail do dono (resolve só quando for usar, p/ não gastar à toa)
    let email: string | null = null
    let primeiroNome = ''
    async function dono(): Promise<string | null> {
      if (email) return email
      const { data: prof } = await admin
        .from('profiles').select('id, nome').eq('empresa_id', emp.id).eq('role', 'admin').limit(1).maybeSingle()
      if (!prof) return null
      const { data: u } = await admin.auth.admin.getUserById(prof.id)
      email = u?.user?.email ?? null
      primeiroNome = (prof.nome || emp.nome || '').split(' ')[0] || ''
      return email
    }

    // Contagens atuais
    const [petsC, presC, recC] = await Promise.all([
      admin.from('pets').select('id', { count: 'exact', head: true }).eq('empresa_id', emp.id),
      admin.from('presencas').select('id', { count: 'exact', head: true }).eq('empresa_id', emp.id),
      admin.from('receitas').select('id', { count: 'exact', head: true }).eq('empresa_id', emp.id),
    ])
    const temPet = (petsC.count ?? 0) > 0
    const temPres = (presC.count ?? 0) > 0
    const temRec = (recC.count ?? 0) > 0

    const novos: string[] = []
    if (temPet && !emp.marco_pet) novos.push('pet')
    if (temPres && !emp.marco_presenca) novos.push('presenca')
    if (temRec && !emp.marco_receita) novos.push('receita')

    let celebrou = false
    if (novos.length > 0) {
      const to = await dono()
      if (to) {
        const faixa = 'Aupi Pet · conquista'
        let titulo = '', corpo = '', cta = '', ctaUrl = url
        if (novos.length >= 2) {
          titulo = 'Você já domou os primeiros passos! 🎉'
          corpo = `${primeiroNome ? primeiroNome + ', ' : ''}a ${emp.nome} já está cadastrando, registrando e cobrando no sistema. Agora é manter o ritmo — os relatórios mostram tudo em tempo real.`
          cta = 'Abrir o painel'; ctaUrl = `${url}/dashboard`
        } else if (novos[0] === 'pet') {
          titulo = 'Primeiro pet cadastrado! 🐾'
          corpo = `${primeiroNome ? primeiroNome + ', ' : ''}o primeiro pet da ${emp.nome} está no sistema. Próximo passo: faça a chamada do dia e veja a creche cheia no painel.`
          cta = 'Fazer a chamada'; ctaUrl = `${url}/creche`
        } else if (novos[0] === 'presenca') {
          titulo = 'Primeira chamada registrada! ✅'
          corpo = `${primeiroNome ? primeiroNome + ', ' : ''}você fez seu primeiro check-in. Agora registre um pagamento para começar a controlar o caixa do negócio.`
          cta = 'Registrar pagamento'; ctaUrl = `${url}/financeiro`
        } else {
          titulo = 'Primeiro pagamento no sistema! 💰'
          corpo = `${primeiroNome ? primeiroNome + ', ' : ''}seu caixa começou a ganhar vida. A partir de agora o painel mostra faturamento, inadimplência e previsão — sem planilha.`
          cta = 'Ver o painel'; ctaUrl = `${url}/dashboard`
        }
        try {
          await resend.emails.send({ from, to, subject: titulo, html: emailHTML(faixa, titulo, corpo, cta, ctaUrl, url, emp.nome) })
          comemorados.push(`${emp.slug}:${novos.join('+')}`)
          celebrou = true
        } catch (e: unknown) { erros.push(`marco ${emp.slug}: ${e instanceof Error ? e.message : String(e)}`) }
      }
      // marca os flags alcançados mesmo se o e-mail falhar (não insistir)
      const upd: Record<string, boolean> = {}
      if (novos.includes('pet')) upd.marco_pet = true
      if (novos.includes('presenca')) upd.marco_presenca = true
      if (novos.includes('receita')) upd.marco_receita = true
      await admin.from('empresas').update(upd).eq('id', emp.id)
    }

    // ── Inatividade comportamental (só se não comemramos hoje e se já operou) ──
    if (!celebrou && temPet) {
      const [{ data: ultPres }, { data: ultRec }] = await Promise.all([
        admin.from('presencas').select('created_at').eq('empresa_id', emp.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('receitas').select('created_at').eq('empresa_id', emp.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      const datas = [ultPres?.created_at, ultRec?.created_at].filter(Boolean).map((d) => new Date(d as string))
      if (datas.length > 0) {
        const ultima = new Date(Math.max(...datas.map((d) => d.getTime())))
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
        const ultimaDia = new Date(ultima); ultimaDia.setHours(0, 0, 0, 0)
        const dias = Math.floor((hoje.getTime() - ultimaDia.getTime()) / 86400000)
        const ultimaStr = ultimaDia.toISOString().split('T')[0]
        // re-arma quando a empresa volta a usar (aviso anterior é mais antigo que a última atividade)
        const jaAvisou = emp.ultimo_aviso_inatividade && emp.ultimo_aviso_inatividade >= ultimaStr
        if (dias >= DIAS_INATIVO && !jaAvisou) {
          const to = await dono()
          if (to) {
            const titulo = `Sentimos sua falta na ${emp.nome} 🐾`
            const corpo = `${primeiroNome ? primeiroNome + ', ' : ''}faz ${dias} dias sem movimento por aqui. Seus dados estão guardados e te esperando — que tal fazer a chamada de hoje em 30 segundos?`
            try {
              await resend.emails.send({ from, to, subject: titulo, html: emailHTML('Aupi Pet · que tal voltar?', titulo, corpo, 'Fazer a chamada de hoje', `${url}/creche`, url, emp.nome) })
              inativos.push(`${emp.slug}:${dias}d`)
            } catch (e: unknown) { erros.push(`inativo ${emp.slug}: ${e instanceof Error ? e.message : String(e)}`) }
          }
          await admin.from('empresas').update({ ultimo_aviso_inatividade: hoje.toISOString().split('T')[0] }).eq('id', emp.id)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, comemorados, inativos, erros })
}
