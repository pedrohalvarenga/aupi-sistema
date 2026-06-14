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

// Dias de carência após o vencimento antes de bloquear.
// Pix/boleto: 5 dias (definido pelo Pedro). Cartão recorrente: a InfinitePay
// retenta automaticamente, então damos uma folga menor.
function diasDeCarencia(empresa: Empresa): number {
  return empresa.forma_pagamento === 'cartao' ? 3 : 5
}

function fimDaCarencia(empresa: Empresa): Date {
  const d = new Date(empresa.trial_ate + 'T23:59:59')
  d.setDate(d.getDate() + diasDeCarencia(empresa))
  return d
}

/** Conta suspensa/cancelada, ou vencida há mais que a carência = acesso bloqueado */
export function acessoBloqueado(empresa: Empresa): boolean {
  if (empresa.status === 'suspenso' || empresa.status === 'cancelado') return true
  if (new Date() > fimDaCarencia(empresa)) return true
  return false
}

export interface StatusAssinatura {
  vencido: boolean        // já passou da data de vencimento
  emCarencia: boolean     // vencido mas ainda dentro da carência (acesso liberado com aviso)
  diasAteVencer: number   // negativo se já venceu
  diasAteBloqueio: number // quantos dias até o bloqueio efetivo
}

/** Calcula o estado da assinatura para mostrar avisos de vencimento ao usuário. */
export function statusAssinatura(empresa: Empresa): StatusAssinatura {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(empresa.trial_ate + 'T00:00:00')
  const fim = fimDaCarencia(empresa)
  const dia = 1000 * 60 * 60 * 24
  const diasAteVencer = Math.ceil((venc.getTime() - hoje.getTime()) / dia)
  const diasAteBloqueio = Math.ceil((fim.getTime() - hoje.getTime()) / dia)
  const vencido = diasAteVencer < 0
  return { vencido, emCarencia: vencido && hoje <= fim, diasAteVencer, diasAteBloqueio }
}
