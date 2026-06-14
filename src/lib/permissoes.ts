import type { UserRole } from '@/types'

// Áreas do app que podem ser liberadas/restringidas por usuário.
export type AreaKey =
  | 'creche' | 'hotel' | 'banho_tosa' | 'transporte'
  | 'pets' | 'tutores' | 'financeiro' | 'importar' | 'admin'

export type Permissoes = Partial<Record<AreaKey, boolean>>

export const AREAS: { key: AreaKey; label: string; desc: string }[] = [
  { key: 'creche',     label: 'Creche',        desc: 'Chamada e diárias' },
  { key: 'hotel',      label: 'Hotel',         desc: 'Reservas e hospedagem' },
  { key: 'banho_tosa', label: 'Banho & Tosa',  desc: 'Agenda de banho e tosa' },
  { key: 'transporte', label: 'Transporte',    desc: 'Rotas, veículos e abastecimento' },
  { key: 'pets',       label: 'Pets',          desc: 'Cadastro e ficha dos pets' },
  { key: 'tutores',    label: 'Tutores',       desc: 'Cadastro dos donos' },
  { key: 'financeiro', label: 'Financeiro',    desc: 'Receitas, despesas e relatórios' },
  { key: 'importar',   label: 'Importar dados',desc: 'Importação com IA' },
  { key: 'admin',      label: 'Administração', desc: 'Usuários e configurações' },
]

// Áreas que cada papel acessa por padrão (espelha o BottomNav + RLS).
const PADRAO: Record<UserRole, AreaKey[]> = {
  super_admin: AREAS.map(a => a.key),
  admin:       AREAS.map(a => a.key),
  recepcao:    ['creche', 'hotel', 'banho_tosa', 'transporte', 'pets', 'tutores', 'financeiro', 'importar'],
  banho_tosa:  ['banho_tosa', 'pets'],
  motorista:   ['transporte'],
}

/** Mapa padrão (todas as áreas) com true/false conforme o papel. */
export function permissoesPadrao(role: UserRole): Permissoes {
  const ativos = new Set(PADRAO[role] ?? [])
  const out: Permissoes = {}
  for (const a of AREAS) out[a.key] = ativos.has(a.key)
  return out
}

/**
 * Permissões efetivas: admin/super_admin sempre têm tudo.
 * Para os demais, a personalização (permissoes) pode RESTRINGIR dentro
 * do que o papel já permite — nunca conceder além (os dados seguem
 * protegidos por RLS pelo papel).
 */
export function permissoesEfetivas(role: UserRole, permissoes?: Permissoes | null): Permissoes {
  const base = permissoesPadrao(role)
  if (role === 'admin' || role === 'super_admin') return base
  if (!permissoes) return base
  const out: Permissoes = {}
  for (const a of AREAS) {
    const padrao = Boolean(base[a.key])
    const escolhido = permissoes[a.key]
    out[a.key] = padrao && (escolhido === undefined ? true : Boolean(escolhido))
  }
  return out
}

export function podeAcessar(area: AreaKey, role: UserRole, permissoes?: Permissoes | null): boolean {
  return Boolean(permissoesEfetivas(role, permissoes)[area])
}
