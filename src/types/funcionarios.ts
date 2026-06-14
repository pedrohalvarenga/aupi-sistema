// Tipos do módulo Funcionários + Comissões

export type ComissaoTipo =
  | 'banho_tosa' | 'hotel' | 'creche' | 'transporte' | 'veterinario' | 'geral'

export interface ComissaoRegra {
  id: string
  empresa_id?: string
  funcionario_id: string
  tipo: ComissaoTipo
  percentual: number
  created_at?: string
}

export interface Funcionario {
  id: string
  empresa_id?: string
  nome_completo: string
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  foto_url: string | null
  email: string | null
  telefone: string | null
  cargo: string | null
  salario: number
  data_admissao: string | null
  tam_calca: string | null
  tam_camisa: string | null
  tam_sapato: string | null
  usuario_id: string | null
  recebe_comissao: boolean
  ativo: boolean
  observacoes: string | null
  created_at: string
  updated_at: string
  regras?: ComissaoRegra[]
}

export interface ComissaoPaga {
  id: string
  empresa_id?: string
  funcionario_id: string
  competencia_mes: number
  competencia_ano: number
  valor_total: number
  despesa_id: string | null
  criado_por: string | null
  created_at: string
}

// Uma linha do extrato de comissão (receita atribuída ao funcionário)
export interface ComissaoLinha {
  receita_id: string
  data: string
  descricao: string
  area: string
  valor: number
  percentual: number
  comissao: number
}

export interface ComissaoResultado {
  linhas: ComissaoLinha[]
  total: number
}

// Comissão calculada de um funcionário num mês (para a página de comissões)
export interface ComissaoMesFuncionario {
  funcionario: Pick<Funcionario, 'id' | 'nome_completo' | 'cargo' | 'foto_url' | 'salario'>
  total: number
  pago: boolean
}

export const COMISSAO_TIPO_LABELS: Record<ComissaoTipo, string> = {
  banho_tosa:  'Banho & Tosa',
  hotel:       'Hotel',
  creche:      'Creche',
  transporte:  'Transporte',
  veterinario: 'Veterinário',
  geral:       'Geral (todas as áreas)',
}

export const MESES_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
