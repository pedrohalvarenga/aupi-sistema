// Importação automática de OUTRAS entidades além de tutores/pets:
// funcionários, fornecedores e lançamentos financeiros (receitas/despesas).
// Registros "planos" (sem filhos aninhados). Isomórfico: só usa
// normalizações puras de ./importar, então é seguro importar no client.

import { txt, normalizarNumero, normalizarData, soDigitos } from './importar'

export type TipoEntidade = 'funcionarios' | 'fornecedores' | 'financeiro'

export type CampoTipo = 'text' | 'number' | 'date' | 'select'

export interface CampoDef {
  key: string
  label: string
  tipo: CampoTipo
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

// Um registro lido pela IA / editado na revisão: mapa simples chave→texto.
export type Registro = Record<string, string>

export interface EntidadeConfig {
  tipo: TipoEntidade
  label: string        // "Funcionários"
  singular: string     // "funcionário"
  plural: string       // "funcionários"
  descricao: string    // texto de ajuda na tela de upload
  campos: CampoDef[]
  // chave para deduplicar (vale tanto p/ registro lido quanto p/ linha do banco)
  chave: (r: Record<string, unknown>) => string
  // converte um registro revisado numa linha de banco; null = ignorar
  paraInsert: (r: Registro, empresaId: string) => { tabela: string; row: Record<string, unknown> } | null
}

// ---- Enums válidos do schema financeiro (evita violar CHECK) ----
const AREAS = ['creche', 'hotel', 'loja', 'banho_tosa', 'transporte', 'outros', 'geral'] as const
const CAT_RECEITA = ['diaria_avulsa', 'pacote_semanal', 'pacote_mensal', 'hotel', 'banho_tosa', 'transporte', 'venda_produto', 'festa', 'foto', 'outros'] as const
const CAT_DESPESA = ['racao_petiscos', 'limpeza', 'produtos_banho_tosa', 'salarios', 'comissoes', 'combustivel', 'manutencao', 'investimento', 'aluguel', 'agua_luz_internet', 'contador', 'marketing', 'impostos', 'taxas_bancarias', 'outros'] as const
const FORMAS = ['pix', 'dinheiro', 'debito', 'credito'] as const

function coage<T extends readonly string[]>(valor: unknown, validos: T, padrao: T[number]): T[number] {
  const s = String(valor ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (validos as readonly string[]).includes(s) ? (s as T[number]) : padrao
}

function normalizarFormaPagamento(v: unknown): typeof FORMAS[number] {
  const s = String(v ?? '').trim().toLowerCase()
  if (/pix/.test(s)) return 'pix'
  if (/din|esp[eé]cie|cash/.test(s)) return 'dinheiro'
  if (/d[eé]bito|debit/.test(s)) return 'debito'
  if (/cr[eé]dito|credit|cart[aã]o/.test(s)) return 'credito'
  return 'pix'
}

function tipoLancamento(v: unknown): 'receita' | 'despesa' {
  const s = String(v ?? '').trim().toLowerCase()
  if (/^r|receit|entrad|venda|cr[eé]dito a receber|recebiment/.test(s)) return 'receita'
  return 'despesa'
}

// ============================================================
//  CONFIGURAÇÕES POR ENTIDADE
// ============================================================

export const ENTIDADES: Record<TipoEntidade, EntidadeConfig> = {
  // ---- FUNCIONÁRIOS ----
  funcionarios: {
    tipo: 'funcionarios',
    label: 'Funcionários',
    singular: 'funcionário',
    plural: 'funcionários',
    descricao: 'Envie a folha, lista ou fichas da equipe. A IA lê nome, cargo, contato, salário e admissão.',
    campos: [
      { key: 'nome_completo', label: 'Nome completo', tipo: 'text', required: true },
      { key: 'cargo', label: 'Cargo', tipo: 'text' },
      { key: 'telefone', label: 'Telefone', tipo: 'text' },
      { key: 'email', label: 'E-mail', tipo: 'text' },
      { key: 'cpf', label: 'CPF', tipo: 'text' },
      { key: 'salario', label: 'Salário (R$)', tipo: 'number' },
      { key: 'data_admissao', label: 'Admissão', tipo: 'date' },
    ],
    chave: (r) => {
      const cpf = soDigitos(r.cpf)
      if (cpf) return 'cpf:' + cpf
      return 'nome:' + String(r.nome_completo ?? '').trim().toLowerCase()
    },
    paraInsert: (r, empresaId) => {
      const nome = txt(r.nome_completo)
      if (!nome) return null
      return {
        tabela: 'funcionarios',
        row: {
          empresa_id: empresaId,
          nome_completo: nome,
          cargo: txt(r.cargo) ?? null,
          telefone: txt(r.telefone) ?? null,
          email: txt(r.email) ?? null,
          cpf: txt(r.cpf) ?? null,
          salario: normalizarNumero(r.salario) ?? 0,
          data_admissao: normalizarData(r.data_admissao) ?? null,
          ativo: true,
        },
      }
    },
  },

  // ---- FORNECEDORES ----
  fornecedores: {
    tipo: 'fornecedores',
    label: 'Fornecedores',
    singular: 'fornecedor',
    plural: 'fornecedores',
    descricao: 'Envie a lista de quem te fornece e presta serviço. A IA lê nome, categoria, contato e CNPJ.',
    campos: [
      { key: 'nome', label: 'Nome / Razão social', tipo: 'text', required: true },
      { key: 'categoria', label: 'Categoria', tipo: 'text' },
      { key: 'contato_nome', label: 'Contato', tipo: 'text' },
      { key: 'telefone', label: 'Telefone', tipo: 'text' },
      { key: 'email', label: 'E-mail', tipo: 'text' },
      { key: 'cnpj', label: 'CNPJ', tipo: 'text' },
    ],
    chave: (r) => {
      const cnpj = soDigitos(r.cnpj)
      if (cnpj) return 'cnpj:' + cnpj
      return 'nome:' + String(r.nome ?? '').trim().toLowerCase()
    },
    paraInsert: (r, empresaId) => {
      const nome = txt(r.nome)
      if (!nome) return null
      return {
        tabela: 'fornecedores',
        row: {
          empresa_id: empresaId,
          nome,
          categoria: txt(r.categoria) ?? null,
          contato_nome: txt(r.contato_nome) ?? null,
          telefone: txt(r.telefone) ?? null,
          email: txt(r.email) ?? null,
          cnpj: txt(r.cnpj) ?? null,
          ativo: true,
        },
      }
    },
  },

  // ---- FINANCEIRO (receitas + despesas) ----
  financeiro: {
    tipo: 'financeiro',
    label: 'Financeiro',
    singular: 'lançamento',
    plural: 'lançamentos',
    descricao: 'Envie extratos, planilhas de caixa ou contas. A IA separa entradas e saídas com data, valor e descrição.',
    campos: [
      { key: 'tipo', label: 'Tipo', tipo: 'select', required: true, options: [
        { value: 'receita', label: 'Entrada (receita)' },
        { value: 'despesa', label: 'Saída (despesa)' },
      ] },
      { key: 'data', label: 'Data', tipo: 'date', required: true },
      { key: 'valor', label: 'Valor (R$)', tipo: 'number', required: true },
      { key: 'descricao', label: 'Descrição', tipo: 'text' },
      { key: 'categoria', label: 'Categoria', tipo: 'text' },
    ],
    chave: (r) => {
      // dedup por data + valor + descrição (lançamentos repetidos)
      const data = normalizarData(r.data) ?? String(r.data ?? '')
      const valor = normalizarNumero(r.valor) ?? r.valor
      const desc = String(r.descricao ?? '').trim().toLowerCase()
      return `${data}|${valor}|${desc}`
    },
    paraInsert: (r, empresaId) => {
      const valor = normalizarNumero(r.valor)
      if (!valor || valor <= 0) return null // CHECK valor > 0
      const data = normalizarData(r.data)
      const descricao = txt(r.descricao) ?? null
      if (tipoLancamento(r.tipo) === 'receita') {
        return {
          tabela: 'receitas',
          row: {
            empresa_id: empresaId,
            data: data ?? new Date().toISOString().split('T')[0],
            valor,
            area: coage(r.area, AREAS, 'geral'),
            categoria: coage(r.categoria, CAT_RECEITA, 'outros'),
            forma_pagamento: normalizarFormaPagamento(r.forma_pagamento),
            descricao,
            status: 'pago',
          },
        }
      }
      return {
        tabela: 'despesas',
        row: {
          empresa_id: empresaId,
          data: data ?? new Date().toISOString().split('T')[0],
          valor,
          area: coage(r.area, AREAS, 'geral'),
          categoria: coage(r.categoria, CAT_DESPESA, 'outros'),
          fornecedor: txt(r.fornecedor) ?? null,
          descricao,
          status: 'pago',
        },
      }
    },
  },
}

export function ehTipoEntidade(v: unknown): v is TipoEntidade {
  return v === 'funcionarios' || v === 'fornecedores' || v === 'financeiro'
}
