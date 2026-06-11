import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEmpresa } from '@/lib/empresa'

/**
 * Popula a empresa do usuário logado com dados de demonstração.
 * Chamado no primeiro login (trial) para que o usuário veja o sistema "vivo".
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const empresa = await getEmpresa()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  // Só popula se ainda não tiver tutores cadastrados
  const { count } = await supabase
    .from('tutores')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa.id)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, mensagem: 'Dados já existem' })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const eid = empresa.id

  // Tutores de exemplo
  const { data: tutores } = await admin.from('tutores').insert([
    { empresa_id: eid, nome: 'Ana Lima', telefone: '(11) 98765-4321', email: 'ana@exemplo.com' },
    { empresa_id: eid, nome: 'Carlos Souza', telefone: '(11) 97654-3210', email: 'carlos@exemplo.com' },
    { empresa_id: eid, nome: 'Mariana Costa', telefone: '(11) 96543-2109', email: 'mariana@exemplo.com' },
  ]).select()

  if (!tutores || tutores.length === 0) {
    return NextResponse.json({ error: 'Falha ao criar tutores de exemplo' }, { status: 500 })
  }

  const hoje = new Date().toISOString().split('T')[0]
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Pets de exemplo
  const { data: pets } = await admin.from('pets').insert([
    {
      empresa_id: eid,
      tutor_id: tutores[0].id,
      nome: 'Mel',
      raca: 'Golden Retriever',
      porte: 'G',
      saldo_diarias: 8,
      plano: 'pacote_mensal',
      ativo: true,
    },
    {
      empresa_id: eid,
      tutor_id: tutores[1].id,
      nome: 'Thor',
      raca: 'Labrador',
      porte: 'G',
      saldo_diarias: 3,
      plano: 'diaria_avulsa',
      ativo: true,
    },
    {
      empresa_id: eid,
      tutor_id: tutores[2].id,
      nome: 'Pituca',
      raca: 'Poodle',
      porte: 'P',
      saldo_diarias: 12,
      plano: 'pacote_mensal',
      ativo: true,
    },
  ]).select()

  if (!pets || pets.length === 0) {
    return NextResponse.json({ error: 'Falha ao criar pets de exemplo' }, { status: 500 })
  }

  // Presenças de hoje (2 pets)
  if (empresa.mod_creche) {
    await admin.from('presencas').insert([
      { empresa_id: eid, pet_id: pets[0].id, data: hoje, checkin_at: new Date().toISOString() },
      { empresa_id: eid, pet_id: pets[2].id, data: hoje, checkin_at: new Date().toISOString() },
      { empresa_id: eid, pet_id: pets[1].id, data: ontem, checkin_at: new Date(Date.now() - 86400000).toISOString(), checkout_at: new Date(Date.now() - 72000000).toISOString() },
    ])
  }

  return NextResponse.json({ ok: true, tutores: tutores.length, pets: pets.length })
}
