import { NextResponse } from 'next/server'
import { anthropic, temAnthropic } from '@/lib/anthropic'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getEmpresa } from '@/lib/empresa'
import { txt } from '@/lib/importar'
import { ENTIDADES, ehTipoEntidade, type Registro, type CampoDef } from '@/lib/importar-entidades'

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

function descreverCampos(campos: CampoDef[]): string {
  return campos.map(c => {
    let d = `${c.key} (${c.label}`
    if (c.tipo === 'date') d += ', formato YYYY-MM-DD'
    if (c.tipo === 'number') d += ', número'
    if (c.tipo === 'select' && c.options) d += ', valores: ' + c.options.map(o => o.value).join('/')
    return d + ')'
  }).join('; ')
}

// ---- Planilha: IA mapeia colunas → campos; parse determinístico das linhas ----
async function analisarPlanilha(buf: Buffer, campos: CampoDef[]): Promise<Registro[]> {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' })
  if (linhas.length < 2) return []

  let hi = 0
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    if (linhas[i].filter(c => String(c).trim()).length >= 2) { hi = i; break }
  }
  const header = (linhas[hi] as unknown[]).map(c => String(c).trim())
  const amostra = linhas.slice(hi + 1, hi + 6)
  const keys = campos.map(c => c.key)

  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `Você mapeia colunas de uma planilha de um negócio pet (creche/hotel/banho).
Para cada campo abaixo, diga qual coluna do cabeçalho corresponde (use o TEXTO EXATO do cabeçalho). Inclua só os campos com correspondência clara; omita o resto.

Campos: ${descreverCampos(campos)}

Cabeçalho: ${JSON.stringify(header)}
Linhas de exemplo: ${JSON.stringify(amostra)}

Responda APENAS JSON, sem markdown: {"mapa": {"<campo>": "<nome exato da coluna>"}}`,
    }],
  })
  const raw = r.content[0]?.type === 'text' ? r.content[0].text : ''
  let mapa: Record<string, string> = {}
  try { mapa = (parseJson<{ mapa: Record<string, string> }>(raw)).mapa ?? {} } catch { mapa = {} }

  const headerLow = header.map(h => h.toLowerCase())
  const colMap: Record<string, number> = {}
  for (const k of keys) {
    const nome = mapa[k]
    colMap[k] = nome ? headerLow.indexOf(String(nome).trim().toLowerCase()) : -1
  }

  const registros: Registro[] = []
  for (let i = hi + 1; i < linhas.length; i++) {
    const row = linhas[i] as unknown[]
    const reg: Registro = {}
    let temAlgo = false
    for (const k of keys) {
      const ci = colMap[k]
      const v = ci >= 0 ? txt(row[ci]) : undefined
      if (v) { reg[k] = v; temAlgo = true }
    }
    if (temAlgo) registros.push(reg)
  }
  return registros
}

// ---- PDF/foto: extração visual direta ----
async function analisarVisual(file: File, campos: CampoDef[]): Promise<Registro[]> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const nome = file.name || ''
  const camposJson = '{' + campos.map(c => `"${c.key}":""`).join(',') + '}'
  const instrucao = `Este arquivo contém dados de um negócio pet. Extraia TODOS os registros e responda APENAS JSON válido, sem markdown, no formato:
{"registros":[${camposJson}]}
Campos: ${descreverCampos(campos)}
Regras: datas em YYYY-MM-DD; valores numéricos sem "R$" nem pontos de milhar (use ponto decimal). Omita campos que não aparecem (não invente). Liste cada linha/registro separadamente.`

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
  let dados: { registros?: Array<Record<string, unknown>> } = {}
  try { dados = parseJson(raw) } catch { return [] }

  const keys = campos.map(c => c.key)
  const registros: Registro[] = []
  for (const item of dados.registros ?? []) {
    const reg: Registro = {}
    let temAlgo = false
    for (const k of keys) {
      const v = txt(item[k])
      if (v) { reg[k] = v; temAlgo = true }
    }
    if (temAlgo) registros.push(reg)
  }
  return registros
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
  const tipo = String(form.get('tipo') ?? '')
  if (!ehTipoEntidade(tipo)) return NextResponse.json({ error: 'Tipo de importação inválido.' }, { status: 400 })
  const config = ENTIDADES[tipo]

  const arquivos = form.getAll('arquivos').filter((f): f is File => f instanceof File)
  if (arquivos.length === 0) return NextResponse.json({ error: 'Envie ao menos um arquivo.' }, { status: 400 })
  if (arquivos.length > 15) return NextResponse.json({ error: 'Envie no máximo 15 arquivos por vez.' }, { status: 400 })

  const erros: string[] = []
  let coletados: Registro[] = []

  for (const file of arquivos) {
    try {
      if (ehPlanilha(file.name, file.type)) {
        const buf = Buffer.from(await file.arrayBuffer())
        coletados = coletados.concat(await analisarPlanilha(buf, config.campos))
      } else if (ehPdf(file.name, file.type) || file.type.startsWith('image/')) {
        coletados = coletados.concat(await analisarVisual(file, config.campos))
      } else {
        erros.push(`Formato não suportado: ${file.name}`)
      }
    } catch (e) {
      console.error('Erro ao analisar', file.name, e)
      erros.push(`Não foi possível ler: ${file.name}`)
    }
  }

  // Dedup dentro do próprio lote (mantém o primeiro de cada chave)
  const vistos = new Set<string>()
  const registros = coletados.filter(r => {
    const k = config.chave(r)
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })

  return NextResponse.json({ registros, resumo: { total: registros.length }, erros })
}
