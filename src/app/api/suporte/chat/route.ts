import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/lib/empresa'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Msg = { role: 'user' | 'assistant'; content: string }

const SISTEMA = `Você é a assistente virtual de suporte do Aupipet (também chamado Aulado), um sistema de gestão para empresas do ramo pet (creche, hotel, banho & tosa e transporte/taxi dog).

Seu papel: ajudar o GESTOR da empresa que usa o sistema, de forma calorosa, objetiva e em português do Brasil.

O que você sabe do sistema:
- Cadastro de tutores (donos) em Tutores › Novo, e de pets em Pets › Novo (dá pra criar o tutor junto do pet).
- Creche: chamada/check-in, pacotes de diárias, extrato mensal por e-mail.
- Hotel: reservas, escala de plantonistas e relatório diário.
- Banho & Tosa: agendamentos e histórico por pet.
- Transporte (Taxi Dog): rotas de coleta e entrega, controle de KM, abastecimento (com leitura do cupom por foto) e manutenção do veículo.
- Financeiro: receitas, despesas, contas, DRE e projeções.
- Administração: criação de usuários da equipe, personalização da marca (logo e cores) em Minha Empresa, e link próprio de cadastro de tutores.
- Cada empresa tem seu link: nomedaempresa.app.aupipet.com.br
- Assinatura é mensal. Trial de 14 dias.

Regras:
- Responda só sobre o sistema e a operação pet. Seja breve (1-3 parágrafos curtos).
- Se você NÃO tiver certeza, se for um bug, uma solicitação de mudança, cobrança/financeiro da assinatura, ou se o gestor pedir para falar com uma pessoa, NÃO invente. Diga que vai encaminhar para a equipe Aupipet e oriente a usar o botão "Falar com a equipe Aupipet", explicando que o retorno é em até 48h.
- Nunca prometa prazos diferentes de 48h para atendimento humano.
- Não invente preços, funcionalidades inexistentes nem dados da empresa.`

export async function POST(request: Request) {
  // Exige usuário autenticado (a página vive dentro do dashboard)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { messages?: Msg[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }) }
  const messages = (body.messages ?? []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-20)
  if (messages.length === 0) return NextResponse.json({ error: 'sem mensagens' }, { status: 400 })

  // Sem IA configurada: responde de forma útil direcionando ao atendimento humano (que usa só e-mail)
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      reply: 'No momento o atendimento por IA está indisponível, mas a nossa equipe pode te ajudar. Toque em "Falar com a equipe Aupipet" aqui embaixo, escreva sua dúvida e retornamos em até 48h. 🐾',
    })
  }

  const empresa = await getEmpresa()
  const contexto = empresa ? `\n\nContexto: a empresa do gestor se chama "${empresa.nome}" (segmento: ${empresa.segmento}, plano: ${empresa.plano}).` : ''

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: SISTEMA + contexto,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
    const texto = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : ''
    return NextResponse.json({ reply: texto || 'Desculpe, não consegui responder agora. Use "Falar com a equipe Aupipet" e retornamos em até 48h.' })
  } catch {
    return NextResponse.json({ error: 'Não foi possível responder agora. Tente novamente ou fale com a equipe.' }, { status: 502 })
  }
}
