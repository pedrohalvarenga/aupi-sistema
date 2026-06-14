import { createClient } from '@supabase/supabase-js'

// A SUPABASE_SERVICE_ROLE_KEY (e a URL) às vezes chegam com BOM (0xFEFF), NBSP,
// zero-width space ou espaços/quebras ao serem coladas no painel da Vercel ou via
// PowerShell no Windows. Um único caractere invisível no início do JWT invalida o
// header Authorization → o PostgREST rebaixa para o papel anônimo e os UPDATEs
// passam a afetar 0 linhas SEM erro (bloqueados por RLS). Como JWT e URL não contêm
// espaços, removemos esses caracteres por código, num único lugar.
const LIXO = new Set([0xfeff, 0x200b, 0x00a0, 0x09, 0x0a, 0x0d, 0x20])

const limpar = (v: string | undefined) =>
  Array.from(v ?? '').filter((ch) => !LIXO.has(ch.charCodeAt(0))).join('')

export const SUPABASE_URL = limpar(process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SERVICE_ROLE_KEY = limpar(process.env.SUPABASE_SERVICE_ROLE_KEY)

/** Cliente Supabase com service role (bypassa RLS). Use só no servidor. */
export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
