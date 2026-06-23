import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Cron semanal: GET /api/cron/dica-semanal  (schedule "0 12 * * 1" = seg 9h BRT)
// E-mail educativo/lembrete para empresas trial/ativas (passada a 1ª semana, p/
// não colidir com a sequência diária de ativação). Rotaciona uma dica por semana.
const SEED_EMPRESA = '00000000-0000-0000-0000-000000000001' // Play Dog — nunca tocar

const DICAS = [
  { titulo: 'Cadastre os pets que mais frequentam primeiro', texto: 'Comece pelos cães do dia a dia. Em uns 10 minutos você já vê a creche cheia no painel e a chamada fica automática.', cta: 'Cadastrar um pet', path: '/pets/novo' },
  { titulo: 'Fotografe o cartão de vacina', texto: 'No cadastro do pet, tire uma foto do cartão: a IA lê e preenche as datas sozinha — e o sistema te avisa quando uma vacina está vencendo.', cta: 'Cadastrar com a IA', path: '/pets/novo' },
  { titulo: 'Pare de cobrar mensalista na unha', texto: 'Configure os pacotes e a cobrança recorrente: o sistema debita a diária a cada presença, avisa o tutor e gera a recompra sozinho.', cta: 'Ver financeiro', path: '/financeiro' },
  { titulo: 'Traga seu caderno ou planilha de uma vez', texto: 'Arraste um Excel, PDF ou fotos das fichas e a inteligência da Aupipet cadastra tutores, pets, vacinas e saldos automaticamente.', cta: 'Importar dados', path: '/importar' },
  { titulo: 'Descubra quem sumiu antes de perder o cliente', texto: 'O relatório de inativos e faltas mostra quem não aparece há semanas — é a hora de mandar um “sentimos sua falta” e recuperar a diária.', cta: 'Ver relatórios', path: '/financeiro' },
  { titulo: 'Coloque sua equipe com acessos separados', texto: 'Cada funcionário entra com o próprio login e vê só o que precisa. Você mantém o controle do financeiro e das configurações.', cta: 'Gerenciar equipe', path: '/funcionarios' },
  { titulo: 'Deixe o app com a sua marca', texto: 'Suba seu logo e escolha as cores (mais fácil pelo computador). Para o seu cliente, o sistema é seu — sem ver o nome Aupipet.', cta: 'Personalizar marca', path: '/empresa' },
]

function semanaDoAno(d: Date): number {
  const ini = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const dias = Math.floor((d.getTime() - ini.getTime()) / 86400000)
  return Math.floor(dias / 7)
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

  const dica = DICAS[semanaDoAno(new Date()) % DICAS.length]

  // Só empresas passada a 1ª semana (a sequência diária cobre os primeiros 7 dias)
  const corte = new Date(); corte.setUTCHours(0, 0, 0, 0); corte.setUTCDate(corte.getUTCDate() - 7)

  const { data: empresas, error } = await admin
    .from('empresas')
    .select('id, nome, slug, status')
    .in('status', ['trial', 'ativo'])
    .neq('id', SEED_EMPRESA)
    .lt('created_at', corte.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enviados: string[] = []
  const erros: string[] = []

  for (const emp of empresas ?? []) {
    const { data: prof } = await admin
      .from('profiles').select('id, nome').eq('empresa_id', emp.id).eq('role', 'admin').limit(1).maybeSingle()
    if (!prof) continue
    const { data: u } = await admin.auth.admin.getUserById(prof.id)
    const email = u?.user?.email
    if (!email) continue

    const url = `https://${emp.slug}.app.aupipet.com.br`
    const primeiroNome = (prof.nome || emp.nome || '').split(' ')[0] || ''
    const html = `
<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="background:#D98232;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">Aupi Pet · dica da semana</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:700;">${dica.titulo}</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6;">${primeiroNome ? primeiroNome + ', ' : ''}${dica.texto}</p>
      <a href="${url}${dica.path}" style="display:block;background:#D98232;color:#fff;text-decoration:none;text-align:center;padding:13px 22px;border-radius:14px;font-size:15px;font-weight:600;margin-bottom:16px;">
        ${dica.cta} →
      </a>
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        <a href="${url}/ajuda" style="color:#D98232;text-decoration:none;">Ver o guia completo</a> · Não quer estes lembretes? Responda este e-mail.
      </p>
    </div>
  </div>
</body></html>`
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
        to: email,
        subject: `Dica da semana: ${dica.titulo.toLowerCase()}`,
        html,
      })
      enviados.push(emp.slug)
    } catch (e: unknown) {
      erros.push(`${emp.slug}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, dica: dica.titulo, enviados, erros })
}
