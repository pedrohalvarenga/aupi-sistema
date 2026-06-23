import { Resend } from 'resend'

// O valor de RESEND_API_KEY/RESEND_FROM às vezes chega com BOM (0xFEFF), NBSP
// (0xA0), zero-width ou espaços/quebras — ao colar no painel da Vercel ou via
// PowerShell no Windows. Qualquer invisível quebra o header Authorization com
// "Cannot convert argument to a ByteString...". Limpamos num único lugar, para
// todos os e-mails do app. (Mesma blindagem de src/lib/anthropic.ts.)
const LIXO = new Set([0xfeff, 0x200b, 0x200c, 0x200d, 0x00a0, 0x09, 0x0a, 0x0d, 0x20])
const INVISIVEIS = new Set([0xfeff, 0x200b, 0x200c, 0x200d, 0x00a0])

// Chave não tem espaços: remove invisíveis E espaços/quebras.
export const RESEND_API_KEY = Array.from(process.env.RESEND_API_KEY ?? '')
  .filter(ch => !LIXO.has(ch.charCodeAt(0)))
  .join('')

// FROM tem espaços internos ("Aupi <no-reply@...>"): remove só invisíveis e apara as pontas.
export const RESEND_FROM = (Array.from(process.env.RESEND_FROM ?? '')
  .filter(ch => !INVISIVEIS.has(ch.charCodeAt(0)))
  .join('')
  .trim()) || 'Aupi <no-reply@aupipet.com.br>'

export const temResend = RESEND_API_KEY.length > 0

export function getResend(): Resend {
  return new Resend(RESEND_API_KEY)
}
