import { createClient } from '@/lib/supabase/server'
import type { Empresa } from '@/types'

/**
 * Carrega a empresa (tenant) do usuário autenticado.
 * Uso em Server Components e Route Handlers.
 */
export async function getEmpresa(): Promise<Empresa | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (!profile?.empresa_id) return null

  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', profile.empresa_id)
    .single<Empresa>()

  return empresa
}

/** Trial expirado ou conta suspensa/cancelada = acesso bloqueado */
export function acessoBloqueado(empresa: Empresa): boolean {
  if (empresa.status === 'suspenso' || empresa.status === 'cancelado') return true
  if (empresa.status === 'trial' && new Date(empresa.trial_ate) < new Date()) return true
  return false
}
