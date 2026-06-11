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
