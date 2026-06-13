import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export async function POST(request: Request) {
  const { nomeEmpresa, segmento, nome, email, senha, whatsapp } = await request.json()

  if (!nomeEmpresa || !nome || !email || !senha) {
    return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 })
  }
  if (senha.length < 8) {
    return NextResponse.json({ error: 'A senha precisa de pelo menos 8 caracteres' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Slug único
  const base = gerarSlug(nomeEmpresa)
  let slug = base
  for (let i = 2; i < 50; i++) {
    const { data } = await admin.from('empresas').select('id').eq('slug', slug).maybeSingle()
    if (!data) break
    slug = `${base}-${i}`
  }

  // Define módulos pelo segmento escolhido
  const seg = ['creche', 'hotel', 'banho_tosa', 'completo'].includes(segmento) ? segmento : 'completo'
  const mods = {
    mod_creche: seg === 'creche' || seg === 'completo',
    mod_hotel: seg === 'hotel' || seg === 'completo',
    mod_banho_tosa: seg === 'banho_tosa' || seg === 'completo',
  }

  // 1. Cria a empresa (trial de 14 dias, definido no default do banco)
  const { data: empresa, error: errEmpresa } = await admin
    .from('empresas')
    .insert({ nome: nomeEmpresa, slug, segmento: seg, whatsapp: whatsapp || null, ...mods })
    .select()
    .single()

  if (errEmpresa) return NextResponse.json({ error: errEmpresa.message }, { status: 400 })

  // 2. Cria o usuário dono (admin) já vinculado à empresa
  const { error: errUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, role: 'admin', empresa_id: empresa.id },
  })

  if (errUser) {
    await admin.from('empresas').delete().eq('id', empresa.id)
    const msg = errUser.message.includes('already')
      ? 'Este e-mail já está cadastrado'
      : errUser.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 3. Contas financeiras iniciais (genéricas e zeradas — o dono edita depois)
  await admin.from('contas_financeiras').insert([
    { empresa_id: empresa.id, nome: 'Conta Bancária 01', tipo: 'banco', saldo_inicial: 0, ativo: true },
    { empresa_id: empresa.id, nome: 'Conta Bancária 02', tipo: 'banco', saldo_inicial: 0, ativo: true },
    { empresa_id: empresa.id, nome: 'Máquina de Cartão', tipo: 'maquina_cartao', saldo_inicial: 0, ativo: true },
    { empresa_id: empresa.id, nome: 'Dinheiro (Caixa)', tipo: 'dinheiro', saldo_inicial: 0, ativo: true },
  ])

  return NextResponse.json({ ok: true, slug: empresa.slug })
}
