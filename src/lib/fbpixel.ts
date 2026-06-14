// Meta (Facebook) Pixel — preencher com o ID quando criado no Gerenciador de
// Eventos da Meta. Enquanto vazio, nada é carregado (sem erro).
export const FB_PIXEL_ID = ''

/** Dispara um evento padrão do Pixel (ex.: 'CompleteRegistration', 'Lead'). */
export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (!FB_PIXEL_ID || typeof window === 'undefined') return
  const w = window as unknown as { fbq?: (...a: unknown[]) => void }
  if (typeof w.fbq === 'function') w.fbq('track', event, params)
}
