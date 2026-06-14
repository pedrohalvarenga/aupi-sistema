// Tipos do módulo Fornecedores

export interface Fornecedor {
  id: string
  empresa_id?: string
  nome: string
  cnpj: string | null
  categoria: string | null
  contato_nome: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  observacoes: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CategoriaFornecedor {
  value: string
  label: string
}

export const CATEGORIAS: CategoriaFornecedor[] = [
  { value: 'racao_insumos', label: 'Ração e insumos' },
  { value: 'medicamentos',  label: 'Medicamentos' },
  { value: 'aluguel',       label: 'Aluguel' },
  { value: 'limpeza',       label: 'Limpeza' },
  { value: 'servicos',      label: 'Serviços' },
  { value: 'equipamentos',  label: 'Equipamentos' },
  { value: 'marketing',     label: 'Marketing' },
  { value: 'outros',        label: 'Outros' },
]

export const CATEGORIA_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map(c => [c.value, c.label])
)
