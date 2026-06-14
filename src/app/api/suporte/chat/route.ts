import { NextResponse } from 'next/server'
import { anthropic as client, temAnthropic } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/lib/empresa'

type Msg = { role: 'user' | 'assistant'; content: string }

const SISTEMA = `Você é a assistente virtual do Aupipet (também chamado Aulado), um sistema de gestão para empresas do ramo pet (creche, hotel, banho & tosa e transporte/taxi dog).

Seu papel: ajudar o GESTOR da empresa que usa o sistema, de forma calorosa, objetiva e em português do Brasil. O Aupipet é 100% self-service e automatizado — VOCÊ é o atendimento. Não existe equipe humana, telefone, chat com pessoas nem fila de tickets, então você nunca encaminha para ninguém: resolve aqui mesmo.

O que você sabe do sistema:
- Cadastro de tutores (donos) em Tutores › Novo, e de pets em Pets › Novo (dá pra criar o tutor junto do pet).
- Importação automática de dados em Administração › "Importar dados com IA": o gestor envia planilha (Excel/CSV), PDF ou foto das fichas e o sistema lê, organiza e cadastra tutores e pets sozinho (ele só revisa e confirma). Use isto sempre que o gestor falar em "migrar", "trazer meus clientes", "cadastrar tudo de uma vez" ou "passar do sistema antigo".
- Creche: chamada/check-in, pacotes de diárias, extrato mensal por e-mail.
- Hotel: reservas, escala de plantonistas e relatório diário.
- Banho & Tosa: agendamentos e histórico por pet.
- Transporte (Taxi Dog): rotas de coleta e entrega, controle de KM, abastecimento (com leitura do cupom por foto) e manutenção do veículo.
- Financeiro: receitas, despesas, contas, DRE e projeções.
- Administração: criação de usuários da equipe, personalização da marca (logo e cores) em Minha Empresa, link próprio de cadastro de tutores, e importação de dados com IA.
- Cada empresa tem seu link: nomedaempresa.app.aupipet.com.br
- Assinatura e cobrança ficam em Assinar/Minha Empresa; trial de 14 dias.

Regras:
- Responda só sobre o sistema e a operação pet. Seja breve (1-3 parágrafos curtos) e prática: diga o CAMINHO exato dentro do app (ex.: "vá em Pets › Novo").
- Resolva sempre você mesma. NUNCA diga que vai "encaminhar para a equipe", "falar com uma pessoa", "abrir um chamado" nem prometa prazos de retorno — isso não existe.
- Se não tiver certeza, ofereça o melhor passo a passo possível e sugira onde no próprio app o gestor confirma (a tela correspondente). Não invente preços, funcionalidades inexistentes nem dados da empresa.
- Para pedidos de migração/cadastro em massa, oriente a usar "Importar dados com IA".`

export async function POST(request: Request) {
  // Exige usuário autenticado (a página vive dentro do dashboard)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { messages?: Msg[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'json inválido' }, { status: 400 }) }
  const messages = (body.messages ?? []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-20)
  if (messages.length === 0) return NextResponse.json({ error: 'sem mensagens' }, { status: 400 })

  // Sem IA configurada: orienta o gestor aos recursos self-service do próprio app.
  if (!temAnthropic) {
    return NextResponse.json({
      reply: 'O assistente está reiniciando e volta já. Enquanto isso, quase tudo se resolve direto no app: cadastros em Tutores › Novo e Pets › Novo, migração em Administração › "Importar dados com IA", e cada módulo tem suas telas no menu inferior. Tente de novo em instantes. 🐾',
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
    return NextResponse.json({ reply: texto || 'Desculpe, não consegui responder agora. Tente reformular a pergunta em instantes. 🐾' })
  } catch (e) {
    console.error('Erro IA suporte/chat:', e instanceof Error ? `${e.name}: ${e.message}` : e)
    return NextResponse.json({ error: 'Não foi possível responder agora. Tente novamente em instantes. 🐾' }, { status: 502 })
  }
}
