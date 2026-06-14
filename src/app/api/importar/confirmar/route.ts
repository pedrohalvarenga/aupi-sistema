import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEmpresa } from '@/lib/empresa'
import { chaveTutor, normalizarPorte, type TutorImport } from '@/lib/importar'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const empresa = await getEmpresa()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  let body: { tutores?: TutorImport[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const tutores = (body.tutores ?? []).filter(t => t && t.nome && t.nome.trim())
  if (tutores.length === 0) return NextResponse.json({ error: 'Nada para importar.' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const eid = empresa.id

  // Tutores já existentes (para não duplicar)
  const { data: existentes } = await admin
    .from('tutores')
    .select('id, nome, telefone, cpf')
    .eq('empresa_id', eid)
  const mapaExistente = new Map<string, string>()
  for (const t of existentes ?? []) mapaExistente.set(chaveTutor(t), t.id)

  // Insere os tutores novos
  const novos = tutores.filter(t => !mapaExistente.has(chaveTutor(t)))
  let tutoresCriados = 0
  if (novos.length > 0) {
    const { data: inseridos, error } = await admin.from('tutores').insert(
      novos.map(t => ({
        empresa_id: eid,
        nome: t.nome.trim(),
        // Se só veio whatsapp, usa ele como telefone (campo principal nas telas).
        telefone: t.telefone || t.whatsapp || '',
        whatsapp: t.whatsapp ?? null,
        email: t.email ?? null,
        cpf: t.cpf ?? null,
        endereco: t.endereco ?? null,
        observacoes: t.observacoes ?? null,
      }))
    ).select('id, nome, telefone, cpf')
    if (error) {
      console.error('Erro ao inserir tutores:', error)
      return NextResponse.json({ error: 'Falha ao salvar tutores: ' + error.message }, { status: 500 })
    }
    tutoresCriados = inseridos?.length ?? 0
    for (const t of inseridos ?? []) mapaExistente.set(chaveTutor(t), t.id)
  }

  // Pets já existentes por tutor (para não duplicar pelo nome)
  const tutorIds = [...mapaExistente.values()]
  const petsExistentes = new Set<string>()
  if (tutorIds.length > 0) {
    const { data: petsAtuais } = await admin
      .from('pets')
      .select('tutor_id, nome')
      .eq('empresa_id', eid)
      .in('tutor_id', tutorIds)
    for (const p of petsAtuais ?? []) petsExistentes.add(p.tutor_id + '|' + String(p.nome).trim().toLowerCase())
  }

  // Monta inserts de pets
  const petsInsert: Record<string, unknown>[] = []
  for (const t of tutores) {
    const tutorId = mapaExistente.get(chaveTutor(t))
    if (!tutorId) continue
    for (const p of t.pets ?? []) {
      if (!p.nome || !p.nome.trim()) continue
      const chavePet = tutorId + '|' + p.nome.trim().toLowerCase()
      if (petsExistentes.has(chavePet)) continue
      petsExistentes.add(chavePet)
      petsInsert.push({
        empresa_id: eid,
        tutor_id: tutorId,
        nome: p.nome.trim(),
        raca: p.raca ?? null,
        porte: normalizarPorte(p.porte),
        castrado: p.castrado ?? false,
        data_nascimento: p.data_nascimento ?? null,
        restricoes: p.restricoes ?? null,
        comportamento: p.comportamento ?? null,
        vacina_v8_v10: p.vacina_v8_v10 ?? null,
        vacina_antirabica: p.vacina_antirabica ?? null,
        vacina_gripe: p.vacina_gripe ?? null,
        saldo_diarias: p.saldo_diarias ?? 0,
        plano: 'diaria_avulsa',
        ativo: true,
      })
    }
  }

  let petsCriados = 0
  if (petsInsert.length > 0) {
    const { data: petsOk, error } = await admin.from('pets').insert(petsInsert).select('id')
    if (error) {
      console.error('Erro ao inserir pets:', error)
      return NextResponse.json({
        error: 'Tutores salvos, mas falhou ao salvar pets: ' + error.message,
        tutores: tutoresCriados, pets: 0,
      }, { status: 500 })
    }
    petsCriados = petsOk?.length ?? 0
  }

  return NextResponse.json({
    ok: true,
    tutores: tutoresCriados,
    pets: petsCriados,
    tutores_ignorados: tutores.length - novos.length,
  })
}
