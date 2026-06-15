export const GA_ID = 'G-ZEZ87VEE12'

/** Dispara um evento para o GA4 (ex.: 'sign_up', 'purchase'). */
export function gtagEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...a: unknown[]) => void }
  if (typeof w.gtag === 'function') w.gtag('event', event, params)
}
