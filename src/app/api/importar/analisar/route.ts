import { NextResponse } from 'next/server'
import { anthropic, temAnthropic } from '@/lib/anthropic'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/lib/empresa'
import {
  CAMPOS_CANONICOS, type MapaColunas, type CampoCanonico, type TutorImport,
  linhaParaTutor, mesclarTutores, normalizarPorte, normalizarBool, normalizarData,
  normalizarNumero, txt, totalPets,
} from '@/lib/importar'

const MODEL = 'claude-haiku-4-5-20251001'
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

function parseJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean) as T
}

function ehPlanilha(nome: string, tipo: string): boolean {
  return /\.(xlsx|xls|csv|tsv)$/i.test(nome) ||
    tipo.includes('spreadsheet') || tipo.includes('excel') || tipo === 'text/csv'
}
function ehPdf(nome: string, tipo: string): boolean {
  return tipo === 'application/pdf' || /\.pdf$/i.test(nome)
}

// ---- Planilhas: parse determinístico + IA só para mapear colunas ----
async function analisarPlanilha(buf: Buffer): Promise<TutorImport[]> {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })
  if (linhas.length < 2) return []

  // Linha de cabeçalho = primeira com 2+ células preenchidas
  let hi = 0
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    if (linhas[i].filter(c => String(c).trim()).length >= 2) { hi = i; break }
  }
  const header = (linhas[hi] as unknown[]).map(c => String(c).trim())
  const amostra = linhas.slice(hi + 1, hi + 6)

  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `Você mapeia colunas de uma planilha de clientes de um negócio pet (creche/hotel/banho).
Para cada campo canônico abaixo, diga qual coluna do cabeçalho corresponde (use o TEXTO EXATO do cabeçalho). Inclua só os campos com correspondência clara; omita o resto.

Campos canônicos: ${CAMPOS_CANONICOS.join(', ')}
Significados: tutor_* = dados do dono; pet_* = dados do cão; pet_porte = P/M/G (pequeno/médio/grande); pet_saldo_diarias = diárias ou créditos restantes; pet_castrado = sim/não.

Cabeçalho: ${JSON.stringify(header)}
Linhas de exemplo: ${JSON.stringify(amostra)}

Responda APENAS JSON, sem markdown: {"mapa": {"<campo_canonico>": "<nome exato da coluna>"}}`,
    }],
  })
  const raw = r.content[0]?.type === 'text' ? r.content[0].text : ''
  let mapa: MapaColunas = {}
  try { mapa = (parseJson<{ mapa: MapaColunas }>(raw)).mapa ?? {} } catch { mapa = {} }

  const headerLow = header.map(h => h.toLowerCase())
  const colMap = {} as Record<CampoCanonico, number>
  for (const campo of CAMPOS_CANONICOS) {
    const nome = mapa[campo]
    colMap[campo] = nome ? headerLow.indexOf(String(nome).trim().toLowerCase()) : -1
  }

  const tutores: TutorImport[] = []
  for (let i = hi + 1; i < linhas.length; i++) {
    const row = linhas[i] as unknown[]
    const get = (campo: CampoCanonico) => { const ci = colMap[campo]; return ci >= 0 ? row[ci] : undefined }
    const t = linhaParaTutor(get)
    if (t) tutores.push(t)
  }
  return mesclarTutores(tutores)
}

// ---- PDF e fotos: extração visual direta pela IA ----
async function analisarVisual(file: File): Promise<TutorImport[]> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const nome = file.name || ''
  const instrucao = `Esta é uma ficha/cadastro de cliente de um negócio pet (pode ter tutor e um ou mais cães).
Extraia os dados e responda APENAS JSON válido, sem markdown, neste formato:
{"tutores":[{"nome":"","telefone":"","whatsapp":"","email":"","cpf":"","endereco":"","observacoes":"","pets":[{"nome":"","raca":"","porte":"P|M|G","castrado":true,"data_nascimento":"YYYY-MM-DD","restricoes":"","comportamento":"","vacina_v8_v10":"YYYY-MM-DD","vacina_antirabica":"YYYY-MM-DD","vacina_gripe":"YYYY-MM-DD","saldo_diarias":0}]}]}
Regras: porte sempre P, M ou G. Datas em YYYY-MM-DD. Omita campos que não aparecem (não invente). Se houver vários tutores/pets, liste todos.`

  const source = ehPdf(nome, file.type)
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: (TIPOS_IMAGEM.includes(file.type as typeof TIPOS_IMAGEM[number]) ? file.type : 'image/jpeg') as typeof TIPOS_IMAGEM[number],
          data: base64,
        },
      }

  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: [source, { type: 'text', text: instrucao }] }],
  })
  const raw = r.content[0]?.type === 'text' ? r.content[0].text : ''
  let dados: { tutores?: Array<Record<string, unknown>> } = {}
  try { dados = parseJson(raw) } catch { return [] }

  const tutores: TutorImport[] = []
  for (const t of dados.tutores ?? []) {
    const nomeT = txt(t.nome)
    if (!nomeT) continue
    const petsRaw = Array.isArray(t.pets) ? (t.pets as Array<Record<string, unknown>>) : []
    tutores.push({
      nome: nomeT,
      telefone: txt(t.telefone),
      whatsapp: txt(t.whatsapp),
      email: txt(t.email),
      cpf: txt(t.cpf),
      endereco: txt(t.endereco),
      observacoes: txt(t.observacoes),
      pets: petsRaw.filter(p => txt(p.nome)).map(p => ({
        nome: txt(p.nome)!,
        raca: txt(p.raca),
        porte: normalizarPorte(p.porte),
        castrado: normalizarBool(p.castrado),
        data_nascimento: normalizarData(p.data_nascimento),
        restricoes: txt(p.restricoes),
        comportamento: txt(p.comportamento),
        vacina_v8_v10: normalizarData(p.vacina_v8_v10),
        vacina_antirabica: normalizarData(p.vacina_antirabica),
        vacina_gripe: normalizarData(p.vacina_gripe),
        saldo_diarias: normalizarNumero(p.saldo_diarias),
      })),
    })
  }
  return tutores
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!temAnthropic) {
    return NextResponse.json({ error: 'A leitura por IA está temporariamente indisponível. Tente novamente em instantes.' }, { status: 503 })
  }
  const empresa = await getEmpresa()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const form = await request.formData()
  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File)
  if (arquivos.length === 0) return NextResponse.json({ error: 'Envie ao menos um arquivo.' }, { status: 400 })
  if (arquivos.length > 15) return NextResponse.json({ error: 'Envie no máximo 15 arquivos por vez.' }, { status: 400 })

  const erros: string[] = []
  let coletados: TutorImport[] = []

  for (const file of arquivos) {
    try {
      if (ehPlanilha(file.name, file.type)) {
        const buf = Buffer.from(await file.arrayBuffer())
        coletados = coletados.concat(await analisarPlanilha(buf))
      } else if (ehPdf(file.name, file.type) || file.type.startsWith('image/')) {
        coletados = coletados.concat(await analisarVisual(file))
      } else {
        erros.push(`Formato não suportado: ${file.name}`)
      }
    } catch (e) {
      console.error('Erro ao analisar', file.name, e)
      erros.push(`Não foi possível ler: ${file.name}`)
    }
  }

  const tutores = mesclarTutores(coletados)
  return NextResponse.json({
    tutores,
    resumo: { tutores: tutores.length, pets: totalPets(tutores) },
    erros,
  })
}
