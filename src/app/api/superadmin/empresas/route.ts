import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  // Só o super_admin (Aulado) pode operar aqui
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { empresaId, acao } = await request.json()
  if (!empresaId || !acao) {
    return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let update: Record<string, unknown> = {}
  if (acao === 'suspender') update = { status: 'suspenso' }
  else if (acao === 'reativar') update = { status: 'ativo' }
  else if (acao === 'cancelar') update = { status: 'cancelado' }
  else if (acao === 'estender_trial') {
    const data = new Date()
    data.setDate(data.getDate() + 14)
    update = { status: 'trial', trial_ate: data.toISOString().slice(0, 10) }
  } else {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const { error } = await admin
    .from('empresas')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
