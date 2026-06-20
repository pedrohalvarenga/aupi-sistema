import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function diasDesde(date: string | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [
    { data: empresas },
    { data: profiles },
    { data: { users } },
    { data: pets },
    { data: tutores },
    { data: presencas },
    { data: hospedagens },
    { data: banhos },
    { data: receitas },
  ] = await Promise.all([
    admin.from('empresas').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, nome, empresa_id, role').eq('role', 'admin'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('pets').select('empresa_id'),
    admin.from('tutores').select('empresa_id'),
    admin.from('presencas').select('empresa_id'),
    admin.from('hospedagens').select('empresa_id'),
    admin.from('agendamentos_banho_tosa').select('empresa_id'),
    admin.from('receitas').select('empresa_id'),
  ])

  const result = (empresas ?? []).map(e => {
    const ownerProfile = (profiles ?? []).find(p => p.empresa_id === e.id)
    const authUser = ownerProfile ? (users ?? []).find(u => u.id === ownerProfile.id) : null

    const userCreatedAt = authUser?.created_at ? new Date(authUser.created_at).getTime() : 0
    const lastSignIn = authUser?.last_sign_in_at ? new Date(authUser.last_sign_in_at).getTime() : 0
    // Se o último login foi dentro de 15s do cadastro, nunca voltou de fato
    const nuncaVoltou = !lastSignIn || (lastSignIn - userCreatedAt) < 15_000

    const totalPets = (pets ?? []).filter(r => r.empresa_id === e.id).length
    const totalTutores = (tutores ?? []).filter(r => r.empresa_id === e.id).length
    const totalPresencas = (presencas ?? []).filter(r => r.empresa_id === e.id).length
    const totalHospedagens = (hospedagens ?? []).filter(r => r.empresa_id === e.id).length
    const totalBanhos = (banhos ?? []).filter(r => r.empresa_id === e.id).length
    const totalReceitas = (receitas ?? []).filter(r => r.empresa_id === e.id).length
    const totalAtividade = totalTutores + totalPets + totalPresencas + totalHospedagens + totalBanhos + totalReceitas

    // health: 'inativo' | 'risco' | 'ativo'
    let health: 'inativo' | 'risco' | 'ativo' = 'inativo'
    if (totalAtividade > 10) health = 'ativo'
    else if (totalAtividade > 0) health = 'risco'

    return {
      id: e.id,
      nome: e.nome,
      slug: e.slug,
      segmento: e.segmento,
      plano: e.plano,
      status: e.status,
      trial_ate: e.trial_ate,
      telefone: e.telefone ?? null,
      whatsapp: e.whatsapp ?? null,
      email_contato: e.email_contato ?? null,
      cidade: e.cidade ?? null,
      logo_url: e.logo_url ?? null,
      created_at: e.created_at,
      // Dono
      owner_nome: ownerProfile?.nome ?? null,
      owner_email: authUser?.email ?? null,
      ultimo_login: authUser?.last_sign_in_at ?? null,
      nunca_voltou: nuncaVoltou,
      // Calculados
      dias_desde_cadastro: diasDesde(e.created_at),
      dias_desde_login: nuncaVoltou ? null : diasDesde(authUser?.last_sign_in_at),
      // Atividade
      total_tutores: totalTutores,
      total_pets: totalPets,
      total_presencas: totalPresencas,
      total_hospedagens: totalHospedagens,
      total_banhos: totalBanhos,
      total_receitas: totalReceitas,
      total_atividade: totalAtividade,
      health,
    }
  })

  return NextResponse.json(result)
}
