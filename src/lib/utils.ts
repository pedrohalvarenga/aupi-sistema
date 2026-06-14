import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, "dd/MM/yyyy 'às' HH:mm")
}

export function formatTime(date: string | Date) {
  return formatDate(date, 'HH:mm')
}

export function calcIdade(dataNascimento: string): string {
  const hoje = new Date()
  const nasc = parseISO(dataNascimento)
  const diffMs = hoje.getTime() - nasc.getTime()
  const anos = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  const meses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44))
  if (anos >= 1) return `${anos} ano${anos > 1 ? 's' : ''}`
  return `${meses} mês${meses !== 1 ? 'es' : ''}`
}

export const PLANO_LABELS: Record<string, string> = {
  diaria_avulsa: 'Diária Avulsa',
  pacote_semanal: 'Pacote Semanal',
  pacote_mensal: 'Pacote Mensal',
  hotel: 'Hotel',
}

export const PORTE_LABELS: Record<string, string> = {
  P: 'Pequeno',
  M: 'Médio',
  G: 'Grande',
}

/**
 * Vacinas anuais: vencida se > 365 dias, atenção se entre 335-365 dias, ok caso contrário.
 * Retorna: 'ok' | 'atencao' | 'vencida' | 'sem_data'
 */
export function vacinaStatus(dataUltimaDose: string | null | undefined): 'ok' | 'atencao' | 'vencida' | 'sem_data' | 'nao_vacinado' {
  if (!dataUltimaDose) return 'sem_data'
  if (dataUltimaDose === 'NAO_VACINADO') return 'nao_vacinado'
  const dose = parseISO(dataUltimaDose)
  const dias = Math.floor((Date.now() - dose.getTime()) / 86_400_000)
  if (dias > 365) return 'vencida'
  if (dias > 335) return 'atencao'
  return 'ok'
}

/**
 * Converte texto em número aceitando formato brasileiro.
 * "1.200,50" -> 1200.5 · "50,00" -> 50 · "120.50" -> 120.5 · "" -> null
 */
export function parseMoeda(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isNaN(v) ? null : v
  let s = String(v).trim().replace(/[^\d.,-]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // BR: ponto = milhar, vírgula = decimal
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function whatsappUrl(telefone: string): string {
  const numero = telefone.replace(/\D/g, '')
  const com55 = numero.startsWith('55') ? numero : `55${numero}`
  return `https://wa.me/${com55}`
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  recepcao: 'Recepção',
  banho_tosa: 'Banho & Tosa',
  motorista: 'Motorista',
}
