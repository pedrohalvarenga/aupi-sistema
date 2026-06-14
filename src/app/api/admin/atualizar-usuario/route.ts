import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin edita um usuário: nome, perfil, ativo e (opcional) nova senha.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id, nome, role, ativo, senha, permissoes } = await request.json()
  if (!id || !nome?.trim() || !['admin', 'recepcao', 'banho_tosa', 'motorista'].includes(role)) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }
  // Admin = acesso total (null); demais guardam o mapa de áreas escolhido.
  const permissoesFinal = role === 'admin' ? null : (permissoes ?? null)

  // Trava de segurança: admin não pode rebaixar ou desativar a si mesmo
  if (id === user.id && (role !== 'admin' || ativo === false)) {
    return NextResponse.json({ error: 'Você não pode remover seu próprio acesso de administrador.' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // ISOLAMENTO: o usuário-alvo precisa ser da MESMA empresa do admin.
  const { data: alvo } = await adminClient.from('profiles').select('empresa_id').eq('id', id).single()
  if (!alvo || alvo.empresa_id !== profile.empresa_id) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  const { error: errProfile } = await adminClient.from('profiles')
    .update({ nome: nome.trim(), role, ativo: ativo !== false, permissoes: permissoesFinal })
    .eq('id', id)
    .eq('empresa_id', profile.empresa_id)
  if (errProfile) {
    console.error('atualizar-usuario profile:', errProfile)
    return NextResponse.json({ error: 'Não foi possível salvar as alterações.' }, { status: 400 })
  }

  const authUpdates: Record<string, unknown> = {
    user_metadata: { nome: nome.trim(), role },
  }
  if (senha && String(senha).length >= 6) {
    authUpdates.password = senha
  }
  const { error: errAuth } = await adminClient.auth.admin.updateUserById(id, authUpdates)
  if (errAuth) {
    console.error('atualizar-usuario auth:', errAuth)
    return NextResponse.json({ error: 'Não foi possível atualizar o acesso.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
