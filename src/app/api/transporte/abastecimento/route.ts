import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Registra abastecimento: foto do cupom no storage + despesa automática
// (area transporte, categoria combustível) + linha em abastecimentos.
// Usa service role para a despesa porque o RLS de despesas é admin-only,
// mas só depois de validar a sessão e o perfil do usuário.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, ativo, nome, empresa_id').eq('id', user.id).single()
  if (!profile?.ativo || !profile.empresa_id || !['admin', 'recepcao', 'motorista'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const empresaId = profile.empresa_id as string

  const formData = await request.formData()
  const km = parseFloat(String(formData.get('km') ?? '').replace(',', '.'))
  const litros = parseFloat(String(formData.get('litros') ?? '').replace(',', '.'))
  const valor = parseFloat(String(formData.get('valor') ?? '').replace(',', '.'))
  const dataParam = String(formData.get('data') ?? '').trim()
  const veiculoId = String(formData.get('veiculo_id') ?? '').trim() || null
  const arquivo = formData.get('arquivo') as File | null

  if (isNaN(km) || km <= 0 || isNaN(litros) || litros <= 0 || isNaN(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Preencha km, litros e valor.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Foto do cupom (opcional)
  let cupomUrl: string | null = null
  if (arquivo && arquivo.size > 0) {
    const ext = arquivo.name.split('.').pop() ?? 'jpg'
    const path = `cupons/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const bytes = await arquivo.arrayBuffer()
    const { error: errUp } = await admin.storage
      .from('fotos')
      .upload(path, bytes, { contentType: arquivo.type || 'image/jpeg', upsert: false })
    if (!errUp) {
      cupomUrl = admin.storage.from('fotos').getPublicUrl(path).data.publicUrl
    }
  }

  // Despesa automática na área transporte
  const hoje = new Date().toISOString().split('T')[0]
  const dataAbastecimento = dataParam || hoje
  const { data: despesa, error: errDesp } = await admin.from('despesas').insert({
    empresa_id: empresaId,
    data: dataAbastecimento,
    valor,
    area: 'transporte',
    categoria: 'combustivel',
    descricao: `Combustível — ${litros.toFixed(2).replace('.', ',')} L · km ${km} · por ${profile.nome}`,
    status: 'pago',
    recorrente: false,
    registrado_por: user.id,
  }).select('id').single()

  if (errDesp) { console.error('abastecimento despesa:', errDesp); return NextResponse.json({ error: 'Não foi possível lançar a despesa.' }, { status: 500 }) }

  const { error: errAb } = await admin.from('abastecimentos').insert({
    empresa_id: empresaId,
    data: dataAbastecimento,
    km_painel: km,
    litros,
    valor_total: valor,
    cupom_url: cupomUrl,
    motorista_id: user.id,
    veiculo_id: veiculoId,
    despesa_id: despesa?.id ?? null,
  })

  if (errAb) { console.error('abastecimento:', errAb); return NextResponse.json({ error: 'Não foi possível registrar o abastecimento.' }, { status: 500 }) }

  // Atualiza o km atual do veículo se o km do painel for maior (escopado à empresa)
  if (veiculoId) {
    await admin.from('veiculos')
      .update({ km_atual: km, updated_at: new Date().toISOString() })
      .eq('id', veiculoId)
      .eq('empresa_id', empresaId)
      .lt('km_atual', km)
  }

  return NextResponse.json({ ok: true })
}
