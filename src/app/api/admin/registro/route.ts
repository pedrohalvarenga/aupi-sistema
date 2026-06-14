import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Ativa/desativa ou exclui tutor/pet — SEMPRE escopado à empresa do admin.
async function adminEmpresa(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role, empresa_id').eq('id', user.id).single()
  if (profile?.role !== 'admin' || !profile.empresa_id) {
    return { erro: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }
  return { empresaId: profile.empresa_id as string }
}

export async function PATCH(request: Request) {
  const ctx = await adminEmpresa(request)
  if ('erro' in ctx) return ctx.erro

  const { tipo, id, ativo } = await request.json()
  const tabela = tipo === 'pet' ? 'pets' : 'tutores'

  const { error } = await createAdminClient().from(tabela)
    .update({ ativo }).eq('id', id).eq('empresa_id', ctx.empresaId)
  if (error) { console.error('registro PATCH:', error); return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const ctx = await adminEmpresa(request)
  if ('erro' in ctx) return ctx.erro

  const { tipo, id } = await request.json()
  const adminClient = createAdminClient()

  if (tipo === 'tutor') {
    // só remove pets do tutor que pertençam à mesma empresa
    const { error: errPets } = await adminClient.from('pets')
      .delete().eq('tutor_id', id).eq('empresa_id', ctx.empresaId)
    if (errPets) { console.error('registro DELETE pets:', errPets); return NextResponse.json({ error: 'Não foi possível excluir.' }, { status: 500 }) }
  }

  const tabela = tipo === 'pet' ? 'pets' : 'tutores'
  const { error } = await adminClient.from(tabela)
    .delete().eq('id', id).eq('empresa_id', ctx.empresaId)
  if (error) { console.error('registro DELETE:', error); return NextResponse.json({ error: 'Não foi possível excluir.' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
