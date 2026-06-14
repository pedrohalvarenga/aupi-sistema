import Anthropic from '@anthropic-ai/sdk'

// O valor da chave as vezes chega com um BOM (0xFEFF), NBSP (0xA0), zero-width
// space (0x200B) ou espacos/quebras - ao colar no painel da Vercel ou via
// PowerShell no Windows. Qualquer um desses quebra o header Authorization com
// "Cannot convert argument to a ByteString...". Chaves Anthropic nao contem
// espacos, entao removemos todos esses caracteres aqui, num unico lugar, para
// todos os usos de IA do app. Filtramos por codigo para nao depender de
// caracteres invisiveis no codigo-fonte.
const LIXO = new Set([0xfeff, 0x200b, 0x00a0, 0x09, 0x0a, 0x0d, 0x20])

export const ANTHROPIC_API_KEY = Array.from(process.env.ANTHROPIC_API_KEY ?? '')
  .filter(ch => !LIXO.has(ch.charCodeAt(0)))
  .join('')

export const temAnthropic = ANTHROPIC_API_KEY.length > 0

export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
