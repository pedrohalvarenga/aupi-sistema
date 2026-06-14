import { createAdminClient } from '@/lib/supabase/admin'
import { calcularComissoes, intervaloMes, type ReceitaComissao } from '@/lib/comissoes'
import type { ComissaoRegra, ComissaoResultado } from '@/types/funcionarios'

/**
 * Calcula a comissão de um funcionário num mês, no servidor, sempre escopado
 * por empresa_id (segurança multi-tenant — nunca confiar no cliente).
 * Usa receitas pagas com funcionario_id = X dentro do mês.
 */
export async function calcularComissaoFuncionario(
  empresaId: string,
  funcionarioId: string,
  ano: number,
  mes: number,
): Promise<ComissaoResultado> {
  const admin = createAdminClient()
  const { inicio, fim } = intervaloMes(ano, mes)

  const { data: regras } = await admin
    .from('comissao_regras')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('funcionario_id', funcionarioId)

  const { data: receitas } = await admin
    .from('receitas')
    .select('id, data, area, valor, valor_liquido, descricao, status, pet:pets(nome)')
    .eq('empresa_id', empresaId)
    .eq('funcionario_id', funcionarioId)
    .eq('status', 'pago')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data')

  const recs: ReceitaComissao[] = ((receitas as unknown[]) ?? []).map((r) => {
    const row = r as {
      id: string; data: string; area: string; valor: number
      valor_liquido: number | null; descricao: string | null; status: string
      pet: { nome: string }[] | { nome: string } | null
    }
    const pet = Array.isArray(row.pet) ? row.pet[0] : row.pet
    return {
      id: row.id, data: row.data, area: row.area, valor: row.valor,
      valor_liquido: row.valor_liquido, descricao: row.descricao, status: row.status,
      pet: pet ?? null,
    }
  })

  return calcularComissoes((regras as ComissaoRegra[]) ?? [], recs)
}
