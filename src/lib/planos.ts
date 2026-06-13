import type { Empresa } from '@/types'

export interface LimitesPlano {
  maxUnidades: number        // -1 = ilimitado
  maxUsuarios: number        // -1 = ilimitado
  whiteLabel: boolean
  multiUnidade: boolean
}

const LIMITES: Record<string, LimitesPlano> = {
  essencial: { maxUnidades: 1, maxUsuarios: 2, whiteLabel: false, multiUnidade: false },
  profissional: { maxUnidades: 1, maxUsuarios: -1, whiteLabel: true, multiUnidade: false },
  escala: { maxUnidades: -1, maxUsuarios: -1, whiteLabel: true, multiUnidade: true },
  // legado
  completo: { maxUnidades: -1, maxUsuarios: -1, whiteLabel: true, multiUnidade: true },
}

export function getLimites(plano: string): LimitesPlano {
  return LIMITES[plano] ?? LIMITES.essencial
}

// ── Preços e info dos planos (para a tela de assinatura) ────
export interface PlanoInfo {
  id: string
  nome: string
  precoCentavos: number
  descricao: string
  destaque?: boolean
}

export const PLANOS: PlanoInfo[] = [
  { id: 'essencial',    nome: 'Essencial',    precoCentavos: 19700, descricao: '1 unidade, 2 usuários' },
  { id: 'profissional', nome: 'Profissional', precoCentavos: 39700, descricao: 'White label, usuários ilimitados', destaque: true },
  { id: 'escala',       nome: 'Escala',       precoCentavos: 69700, descricao: 'Multi-unidades, tudo ilimitado' },
]

export function getPlanoInfo(id: string): PlanoInfo | undefined {
  return PLANOS.find(p => p.id === id)
}

export function podeCriarUsuario(empresa: Empresa, totalUsuariosAtual: number): boolean {
  const { maxUsuarios } = getLimites(empresa.plano)
  if (maxUsuarios === -1) return true
  return totalUsuariosAtual < maxUsuarios
}

export function podeCriarUnidade(empresa: Empresa, totalUnidadesAtual: number): boolean {
  const { maxUnidades } = getLimites(empresa.plano)
  if (maxUnidades === -1) return true
  return totalUnidadesAtual < maxUnidades
}
