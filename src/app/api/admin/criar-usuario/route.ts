import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEmpresa } from '@/lib/empresa'
import { podeCriarUsuario } from '@/lib/planos'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Verificar limite de usuários do plano
  const empresa = await getEmpresa()
  if (empresa) {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', profile.empresa_id)
      .eq('ativo', true)
    if (!podeCriarUsuario(empresa, count ?? 0)) {
      return NextResponse.json(
        { error: `Seu plano ${empresa.plano} permite no máximo ${empresa.plano === 'essencial' ? '2 usuários' : 'este número de usuários'}. Faça upgrade para adicionar mais.` },
        { status: 403 }
      )
    }
  }

  const { nome, email, senha, role } = await request.json()

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, role, empresa_id: profile.empresa_id },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await adminClient.from('profiles').upsert({
    id: newUser.user.id,
    email,
    nome,
    role,
    empresa_id: profile.empresa_id,
    ativo: true,
  })

  return NextResponse.json({ ok: true })
}
