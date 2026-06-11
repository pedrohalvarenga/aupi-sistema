import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug ausente' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data } = await admin
    .from('empresas')
    .select('nome, slug, logo_url, cor_primaria, cor_secundaria, whatsapp, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!data || data.status === 'cancelado' || data.status === 'suspenso') {
    return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  }

  const { status: _status, ...publico } = data
  return NextResponse.json(publico)
}
