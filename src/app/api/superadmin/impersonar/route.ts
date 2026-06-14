import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Inicia ou encerra a impersonação de uma empresa pelo super_admin.
// body: { empresaId } para entrar; { empresaId: null } para sair.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let empresaId: string | null = null
  try {
    const body = await request.json()
    empresaId = body?.empresaId ?? null
  } catch { /* sair = body vazio */ }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Ao entrar, confere que a empresa existe (evita id inválido)
  if (empresaId) {
    const { data: emp } = await admin.from('empresas').select('id').eq('id', empresaId).single()
    if (!emp) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  const { error } = await admin
    .from('profiles')
    .update({ impersonando_empresa_id: empresaId })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, impersonando: empresaId })
}
