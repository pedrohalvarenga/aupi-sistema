import type { ComissaoRegra, ComissaoTipo, ComissaoLinha, ComissaoResultado } from '@/types/funcionarios'

// Receita mínima necessária para calcular comissão. Mantemos solto para
// poder reaproveitar tanto no servidor quanto no cliente sem acoplar ao
// tipo Receita completo do financeiro.
export interface ReceitaComissao {
  id: string
  data: string
  area: string
  valor: number
  valor_liquido?: number | null
  descricao?: string | null
  status?: string
  pet?: { nome: string } | null
}

/**
 * Mapeia a área da receita para o tipo de regra de comissão.
 * As áreas que batem em nome (banho_tosa, hotel, creche, transporte) são
 * diretas. Veterinário e receitas avulsas costumam entrar como 'outros'/
 * 'geral'/'loja' e caem na regra 'geral' (fallback).
 */
function tipoDaArea(area: string): ComissaoTipo | null {
  switch (area) {
    case 'banho_tosa': return 'banho_tosa'
    case 'hotel':      return 'hotel'
    case 'creche':     return 'creche'
    case 'transporte': return 'transporte'
    case 'veterinario': return 'veterinario'
    default:           return null // outros/loja/geral -> fallback 'geral'
  }
}

/** Escolhe o percentual aplicável a uma receita a partir das regras do funcionário. */
function percentualParaArea(area: string, regras: ComissaoRegra[]): number | null {
  const tipo = tipoDaArea(area)
  if (tipo) {
    const especifica = regras.find(r => r.tipo === tipo)
    if (especifica) return Number(especifica.percentual)
  }
  const geral = regras.find(r => r.tipo === 'geral')
  return geral ? Number(geral.percentual) : null
}

/**
 * Calcula as linhas de comissão de um funcionário num mês.
 * Função PURA: recebe as regras e as receitas já filtradas (funcionario_id,
 * status pago, dentro do mês) e devolve as linhas + total.
 * Usa valor_liquido quando existir (líquido de taxas de cartão), senão valor.
 */
export function calcularComissoes(
  regras: ComissaoRegra[],
  receitas: ReceitaComissao[],
): ComissaoResultado {
  const linhas: ComissaoLinha[] = []

  for (const r of receitas) {
    const percentual = percentualParaArea(r.area, regras)
    if (percentual == null) continue // funcionário não comissiona essa área

    const base = r.valor_liquido != null ? Number(r.valor_liquido) : Number(r.valor)
    const comissao = Math.round(base * (percentual / 100) * 100) / 100

    const descricao = (r.descricao?.trim() || r.pet?.nome || 'Serviço')

    linhas.push({
      receita_id: r.id,
      data: r.data,
      descricao,
      area: r.area,
      valor: base,
      percentual,
      comissao,
    })
  }

  const total = Math.round(linhas.reduce((s, l) => s + l.comissao, 0) * 100) / 100
  return { linhas, total }
}

/** Primeiro e último dia (YYYY-MM-DD) do mês informado. mes = 1..12 */
export function intervaloMes(ano: number, mes: number): { inicio: string; fim: string } {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}
