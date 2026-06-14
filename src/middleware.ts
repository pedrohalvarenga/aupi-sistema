import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { slugDoHost } from '@/lib/dominio'
import { podeAcessar, type AreaKey, type Permissoes } from '@/lib/permissoes'
import type { UserRole } from '@/types'

// Páginas protegidas: por área (permissões) e/ou só admin.
const GUARD: { prefix: string; area?: AreaKey; soAdmin?: boolean }[] = [
  { prefix: '/admin', soAdmin: true },
  { prefix: '/empresa', soAdmin: true },
  { prefix: '/creche', area: 'creche' },
  { prefix: '/hotel', area: 'hotel' },
  { prefix: '/banho-tosa', area: 'banho_tosa' },
  { prefix: '/transportes', area: 'transporte' },
  { prefix: '/pets', area: 'pets' },
  { prefix: '/tutores', area: 'tutores' },
  { prefix: '/financeiro', area: 'financeiro' },
  { prefix: '/importar', area: 'importar' },
]

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

  // Guard por página: papel + permissões (enforcement server-side do menu)
  const regra = user && !isPublic
    ? GUARD.find(g => pathname === g.prefix || pathname.startsWith(g.prefix + '/'))
    : undefined
  const ehSuperadmin = pathname === '/superadmin' || pathname.startsWith('/superadmin/')
  if (user && (regra || ehSuperadmin)) {
    const { data: prof } = await supabase
      .from('profiles').select('role, permissoes').eq('id', user.id).single()
    const role = prof?.role as UserRole | undefined
    if (role === 'super_admin') {
      // super_admin só no /superadmin; se cair numa página de tenant, manda pro painel dele
      if (regra) return NextResponse.redirect(new URL('/superadmin', request.url))
    } else {
      if (ehSuperadmin) return NextResponse.redirect(new URL('/dashboard', request.url))
      if (regra?.soAdmin && role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      if (regra?.area && role && !podeAcessar(regra.area, role, (prof?.permissoes as Permissoes) ?? null)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'],
}
