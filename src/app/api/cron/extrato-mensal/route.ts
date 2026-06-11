import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron mensal: envia o extrato do mês anterior aos tutores de CADA empresa
// que tiver o envio automático habilitado nas configurações da creche.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const hoje = new Date()
  const mesRef = hoje.getMonth() === 0 ? 12 : hoje.getMonth()
  const anoRef = hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()

  const { data: empresas } = await admin
    .from('empresas')
    .select('id, nome')
    .eq('mod_creche', true)
    .in('status', ['trial', 'ativo', 'inadimplente'])

  const resultados: { empresa: string; enviados: number; erros: number; skipped?: string }[] = []

  for (const empresa of empresas ?? []) {
    const { data: config } = await admin
      .from('config_creche')
      .select('chave, valor')
      .eq('empresa_id', empresa.id)
      .in('chave', ['envio_extrato_automatico', 'dia_envio_extrato'])

    const habilitado = config?.find(c => c.chave === 'envio_extrato_automatico')?.valor === 'true'
    if (!habilitado) {
      resultados.push({ empresa: empresa.nome, enviados: 0, erros: 0, skipped: 'desabilitado' })
      continue
    }

    const diaEnvio = Number(config?.find(c => c.chave === 'dia_envio_extrato')?.valor ?? '1')
    if (hoje.getDate() !== diaEnvio) {
      resultados.push({ empresa: empresa.nome, enviados: 0, erros: 0, skipped: `hoje não é dia ${diaEnvio}` })
      continue
    }

    const { data: tutores } = await admin
      .from('tutores')
      .select('id, email, nome')
      .eq('empresa_id', empresa.id)
      .not('email', 'is', null)
      .neq('email', '')

    let enviados = 0
    let erros = 0
    for (const tutor of tutores ?? []) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/email/enviar-extrato`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET ?? '',
        },
        body: JSON.stringify({ tutor_id: tutor.id, mes: mesRef, ano: anoRef }),
      })
      if (res.ok) enviados++
      else erros++
    }
    resultados.push({ empresa: empresa.nome, enviados, erros })
  }

  return NextResponse.json({ ok: true, mes: mesRef, ano: anoRef, resultados })
}
