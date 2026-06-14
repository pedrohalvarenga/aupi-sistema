// Cliente mínimo da API Asaas (cobrança recorrente da plataforma Aupipet).
// Sandbox: https://api-sandbox.asaas.com/v3 · Produção: https://api.asaas.com/v3

const BASE = (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').trim()
const KEY = (process.env.ASAAS_API_KEY || '').trim()

function headers() {
  return { 'Content-Type': 'application/json', access_token: KEY }
}

export function asaasConfigurado(): boolean {
  return Boolean(KEY)
}

export async function asaasPost(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`)
  return data
}

export async function asaasGet(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`)
  return data
}
