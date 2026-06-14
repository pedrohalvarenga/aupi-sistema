// Importação automática de dados (planilhas, PDFs e fotos) com apoio de IA.
// Tipos e normalizações compartilhados entre as rotas /api/importar/*.

export interface PetImport {
  nome: string
  raca?: string
  porte: 'P' | 'M' | 'G'
  castrado?: boolean
  data_nascimento?: string
  restricoes?: string
  comportamento?: string
  vacina_v8_v10?: string
  vacina_antirabica?: string
  vacina_gripe?: string
  saldo_diarias?: number
}

export interface TutorImport {
  nome: string
  telefone?: string
  whatsapp?: string
  email?: string
  cpf?: string
  endereco?: string
  observacoes?: string
  pets: PetImport[]
}

// Campos canônicos que a IA tenta mapear a partir do cabeçalho de uma planilha.
export const CAMPOS_CANONICOS = [
  'tutor_nome', 'tutor_telefone', 'tutor_whatsapp', 'tutor_email', 'tutor_cpf',
  'tutor_endereco', 'tutor_observacoes',
  'pet_nome', 'pet_raca', 'pet_porte', 'pet_castrado', 'pet_nascimento',
  'pet_restricoes', 'pet_comportamento', 'pet_saldo_diarias',
] as const

export type CampoCanonico = typeof CAMPOS_CANONICOS[number]
export type MapaColunas = Partial<Record<CampoCanonico, string>>

export function soDigitos(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '')
}

export function txt(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  return s.length ? s : undefined
}

export function normalizarPorte(v: unknown): 'P' | 'M' | 'G' {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return 'M'
  if (/^p|peq|small|mini|toy/.test(s)) return 'P'
  if (/^g|gra|grd|large|gigante/.test(s)) return 'G'
  if (/^m|med|médio|medio|medium/.test(s)) return 'M'
  return 'M'
}

export function normalizarBool(v: unknown): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return undefined
  if (/^(s|sim|y|yes|true|1|x|castrad)/.test(s)) return true
  if (/^(n|não|nao|no|false|0)/.test(s)) return false
  return undefined
}

export function normalizarNumero(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

// Aceita dd/mm/aaaa, aaaa-mm-dd e serial de Excel; devolve sempre aaaa-mm-dd ou undefined.
export function normalizarData(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    const d = br[1].padStart(2, '0')
    const m = br[2].padStart(2, '0')
    let a = br[3]
    if (a.length === 2) a = (Number(a) > 50 ? '19' : '20') + a
    return `${a}-${m}-${d}`
  }
  // Serial de Excel (dias desde 1899-12-30)
  const serial = Number(s)
  if (Number.isFinite(serial) && serial > 59 && serial < 60000) {
    const ms = (serial - 25569) * 86400 * 1000
    const dt = new Date(ms)
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0]
  }
  return undefined
}

// Chave para juntar várias linhas/registros do mesmo tutor.
// Usa CPF > telefone/whatsapp > nome (nessa ordem de confiabilidade).
export function chaveTutor(t: { nome?: string; telefone?: string; whatsapp?: string; cpf?: string }): string {
  const cpf = soDigitos(t.cpf)
  if (cpf) return 'cpf:' + cpf
  const tel = soDigitos(t.telefone) || soDigitos(t.whatsapp)
  if (tel) return 'tel:' + tel
  return 'nome:' + String(t.nome ?? '').trim().toLowerCase()
}

/**
 * Junta uma lista de tutores (cada um já com seus pets) deduplicando pelo
 * mesmo tutor — útil quando a planilha tem uma linha por pet.
 */
export function mesclarTutores(lista: TutorImport[]): TutorImport[] {
  const mapa = new Map<string, TutorImport>()
  for (const t of lista) {
    if (!t.nome || !t.nome.trim()) continue
    const k = chaveTutor(t)
    const existente = mapa.get(k)
    if (existente) {
      // completa campos vazios e acumula pets
      existente.telefone ??= t.telefone
      existente.whatsapp ??= t.whatsapp
      existente.email ??= t.email
      existente.cpf ??= t.cpf
      existente.endereco ??= t.endereco
      existente.observacoes ??= t.observacoes
      for (const p of t.pets) {
        if (p.nome && !existente.pets.some(x => x.nome.trim().toLowerCase() === p.nome.trim().toLowerCase())) {
          existente.pets.push(p)
        }
      }
    } else {
      mapa.set(k, { ...t, pets: [...t.pets] })
    }
  }
  return [...mapa.values()]
}

/** Constrói um tutor (com pet, se houver) a partir de uma linha de planilha já mapeada. */
export function linhaParaTutor(get: (campo: CampoCanonico) => unknown): TutorImport | null {
  const nome = txt(get('tutor_nome'))
  if (!nome) return null
  const pets: PetImport[] = []
  const petNome = txt(get('pet_nome'))
  if (petNome) {
    pets.push({
      nome: petNome,
      raca: txt(get('pet_raca')),
      porte: normalizarPorte(get('pet_porte')),
      castrado: normalizarBool(get('pet_castrado')),
      data_nascimento: normalizarData(get('pet_nascimento')),
      restricoes: txt(get('pet_restricoes')),
      comportamento: txt(get('pet_comportamento')),
      saldo_diarias: normalizarNumero(get('pet_saldo_diarias')),
    })
  }
  return {
    nome,
    telefone: txt(get('tutor_telefone')),
    whatsapp: txt(get('tutor_whatsapp')),
    email: txt(get('tutor_email')),
    cpf: txt(get('tutor_cpf')),
    endereco: txt(get('tutor_endereco')),
    observacoes: txt(get('tutor_observacoes')),
    pets,
  }
}

export function totalPets(tutores: TutorImport[]): number {
  return tutores.reduce((s, t) => s + t.pets.length, 0)
}
