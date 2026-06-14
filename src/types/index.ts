export type UserRole = 'super_admin' | 'admin' | 'recepcao' | 'banho_tosa' | 'motorista'

export interface Empresa {
  id: string
  nome: string
  slug: string
  segmento: 'creche' | 'hotel' | 'banho_tosa' | 'completo'
  logo_url?: string | null
  cor_primaria: string
  cor_secundaria: string
  telefone?: string | null
  whatsapp?: string | null
  email_contato?: string | null
  endereco?: string | null
  cidade?: string | null
  mod_creche: boolean
  mod_hotel: boolean
  mod_banho_tosa: boolean
  mod_transporte: boolean
  mod_financeiro: boolean
  plano: 'essencial' | 'profissional' | 'escala' | 'completo'
  status: 'trial' | 'ativo' | 'inadimplente' | 'suspenso' | 'cancelado'
  trial_ate: string
  forma_pagamento?: 'cartao' | 'pix' | 'boleto' | null
  created_at: string
}

export type Porte = 'P' | 'M' | 'G'

export type PlanoTipo = 'diaria_avulsa' | 'pacote_semanal' | 'pacote_mensal' | 'hotel'

export type AreaServicoPet = 'creche' | 'hotel' | 'banho_tosa' | 'adaptacao'

export type FormaPagamentoCreche = 'pix_pagbank' | 'pix_c6' | 'dinheiro' | 'debito' | 'credito'

export interface Profile {
  id: string
  email: string
  nome: string
  role: UserRole
  empresa_id?: string | null
  ativo: boolean
  permissoes?: Record<string, boolean> | null
  created_at: string
}

export interface Tutor {
  id: string
  nome: string
  telefone: string
  whatsapp?: string
  email?: string
  cpf?: string
  endereco?: string
  observacoes?: string
  preco_personalizado?: number
  created_at: string
  updated_at: string
}

export interface Pet {
  id: string
  tutor_id: string
  nome: string
  identificador?: string
  raca?: string
  porte: Porte
  data_nascimento?: string
  foto_url?: string
  castrado: boolean
  restricoes?: string
  comportamento?: string
  vacina_v8_v10?: string
  vacina_antirabica?: string
  vacina_gripe?: string
  areas_servico?: AreaServicoPet[]
  plano: PlanoTipo
  plano_diarias_total?: number
  plano_inicio?: string
  plano_fim?: string
  saldo_diarias: number
  ativo: boolean
  created_at: string
  updated_at: string
  tutor?: Tutor
}

export interface Presenca {
  id: string
  pet_id: string
  data: string
  checkin_at?: string
  checkout_at?: string
  observacoes?: string
  registrado_por?: string
  created_at: string
  pet?: Pet
}

export interface DiariaSaldo {
  id: string
  pet_id: string
  plano: PlanoTipo
  diarias_contratadas: number
  diarias_usadas: number
  periodo_inicio: string
  periodo_fim: string
  created_at: string
}

export interface ComprasDiarias {
  id: string
  pet_id: string
  tutor_id: string
  quantidade: number
  valor_pago: number
  forma_pagamento: FormaPagamentoCreche
  data: string
  observacoes?: string
  registrado_por?: string
  created_at: string
}

export interface AjusteSaldo {
  id: string
  pet_id: string
  quantidade: number
  motivo: string
  registrado_por?: string
  created_at: string
}

export interface Ocorrencia {
  id: string
  pet_id: string
  descricao: string
  foto_url?: string
  registrado_por?: string
  created_at: string
}
