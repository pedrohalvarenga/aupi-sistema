import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { slugDoHost } from '@/lib/dominio'

export async function middleware(request: NextRequest) {
  // Subdomínio da empresa (ex.: patinhas.app.aupipet.com.br -> "patinhas").
  // Repassamos via header para os Server Components lerem o tenant pela URL.
  const empresaSlug = slugDoHost(request.headers.get('host'))
  const requestHeaders = new Headers(request.headers)
  if (empresaSlug) requestHeaders.set('x-empresa-slug', empresaSlug)
  const nextOptions = { request: { headers: requestHeaders } }

  let supabaseResponse = NextResponse.next(nextOptions)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next(nextOptions)
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: object }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Cadastro público pelo subdomínio: injeta ?e=slug automaticamente
  if (empresaSlug && pathname === '/cadastro' && !request.nextUrl.searchParams.get('e')) {
    const url = request.nextUrl.clone()
    url.searchParams.set('e', empresaSlug)
    return NextResponse.redirect(url)
  }

  // Rotas públicas — não exigem autenticação
  const publicPaths = ['/login', '/comecar', '/api/onboarding', '/api/asaas/webhook', '/api/infinitepay/webhook', '/api/empresa-publica', '/cadastro', '/api/cadastro-publico', '/api/upload-foto-pet', '/api/analisar-vacinas', '/api/auth/email-por-nome']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // Redireciona para login se não autenticado
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redireciona para dashboard se já autenticado tentando acessar login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Super admin (Aupi) opera no painel de clientes
  if (user && pathname === '/dashboard') {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'super_admin') {
      return NextResponse.redirect(new URL('/superadmin', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'],
}
