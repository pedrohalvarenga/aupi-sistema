import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

  // 3. Contas financeiras iniciais — padrão do sistema: apenas 2, zeradas.
  //    O cliente cria as demais contas que precisar em Financeiro > Contas.
  await admin.from('contas_financeiras').insert([
    { empresa_id: empresa.id, nome: 'Conta Corrente', tipo: 'banco', saldo_inicial: 0, ativo: true },
    { empresa_id: empresa.id, nome: 'Dinheiro', tipo: 'dinheiro', saldo_inicial: 0, ativo: true },
  ])

  // 4. E-mail de boas-vindas com link direto para o primeiro passo
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const url = `https://${empresa.slug}.app.aupipet.com.br`
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Aupi <no-reply@aupipet.com.br>',
      to: email,
      subject: `${nomeEmpresa}, seu sistema está pronto! 🐾`,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.06);">
    <div style="background:#D98232;padding:32px 28px 24px;">
      <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">Aupi Pet</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">Bem-vindo, ${nome.split(' ')[0]}! 🎉</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        O sistema da <strong>${nomeEmpresa}</strong> está configurado e pronto para usar.<br>
        Seu primeiro passo é cadastrar um pet — o tutor entra no mesmo cadastro e a IA até lê o cartão de vacina por foto. É o que destrava agenda, ficha, cobrança e relatórios.
      </p>
      <a href="${url}/pets/novo"
        style="display:block;background:#D98232;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:14px;font-size:15px;font-weight:600;margin-bottom:24px;">
        Cadastrar primeiro pet →
      </a>
      <div style="background:#f8f9fa;border-radius:14px;padding:16px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Seu endereço de acesso</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">${url}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Salve este link — é por aqui que você e sua equipe entram.</p>
      </div>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Dúvidas? Responda este e-mail ou fale pelo WhatsApp.<br>
        <a href="${url}" style="color:#D98232;text-decoration:none;">Acessar o sistema</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    })
  } catch {
    // e-mail falhou, mas o cadastro foi bem-sucedido — não bloqueia
  }

  return NextResponse.json({ ok: true, slug: empresa.slug })
}
