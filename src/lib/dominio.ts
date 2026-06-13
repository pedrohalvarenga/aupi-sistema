/**
 * Domínio / subdomínio por empresa (white-label).
 *
 * Cada empresa tem um endereço próprio no formato:
 *   https://<slug>.app.aupipet.com.br
 *
 * O host base pode ser sobrescrito por ambiente (preview/staging) via
 * NEXT_PUBLIC_APP_HOST. Em produção o padrão é app.aupipet.com.br.
 */

export const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || 'app.aupipet.com.br').trim()

// Labels que NÃO representam uma empresa (raiz, www, painel)
const RESERVADOS = new Set(['app', 'www', 'admin', 'api', 'painel', 'staging'])

/** Mesma regra de slug do onboarding, disponível também no client. */
export function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** URL pública completa da empresa: https://slug.app.aupipet.com.br */
export function urlEmpresa(slug: string): string {
  const s = slug?.trim()
  if (!s) return `https://${APP_HOST}`
  return `https://${s}.${APP_HOST}`
}

/** Versão "bonita" para exibir na tela (sem https://). */
export function hostEmpresa(slug: string): string {
  const s = slug?.trim()
  if (!s) return APP_HOST
  return `${s}.${APP_HOST}`
}

/**
 * Extrai o slug da empresa a partir do host da requisição.
 * Retorna null para o host raiz, www, localhost, previews da Vercel, etc.
 */
export function slugDoHost(host: string | null | undefined): string | null {
  if (!host) return null
  const h = host.split(':')[0].toLowerCase() // remove porta

  // Localhost e IPs não têm tenant por subdomínio
  if (h === 'localhost' || h.endsWith('.localhost') || /^[\d.]+$/.test(h)) return null

  // Só consideramos subdomínio quando o host termina em ".<APP_HOST>"
  const sufixo = `.${APP_HOST}`
  if (!h.endsWith(sufixo)) return null

  const label = h.slice(0, h.length - sufixo.length)
  if (!label || label.includes('.')) return null // multi-nível -> ignora
  if (RESERVADOS.has(label)) return null
  return label
}
