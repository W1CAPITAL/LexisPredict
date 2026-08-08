/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Middleware unificado: sessão Supabase + headers de segurança + rotas admin.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_WEIGHT: Record<string, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
}

const ADMIN_ONLY = ['/supervisao', '/auditoria', '/team']
const SUPERADMIN_ONLY = ['/security']

function applySecurityHeaders(res: NextResponse) {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  // CSP reforçado também no middleware (defesa em profundidade)
  if (!res.headers.has('Content-Security-Policy')) {
    res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ')
    )
  }
  return res
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const path = request.nextUrl.pathname
  const isPublicFile =
    /\.(.*)$/.test(path) ||
    path.startsWith('/api') ||
    path.includes('manifest.json') ||
    path.includes('favicon.ico')

  // Rate-limit leve no login (cookie sliding window)
  if (path === '/login' && request.method === 'GET') {
    const hits = Number(request.cookies.get('lexis_login_hits')?.value || '0')
    if (hits > 40) {
      const blocked = NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 }
      )
      return applySecurityHeaders(blocked)
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key && !isPublicFile) {
    const supabase = createServerClient(url, key, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({
            name,
            value,
            ...options,
            httpOnly: options.httpOnly ?? true,
            sameSite: options.sameSite ?? 'lax',
            secure: process.env.NODE_ENV === 'production' ? true : options.secure,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAuthPage = path === '/login' || path === '/signup'

    if (!user && !isAuthPage) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }

    if (user && isAuthPage) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  // Rotas admin por cargo (cookie lexis_user_role)
  const isAdminPath = ADMIN_ONLY.some(
    (p) => path === p || path.startsWith(`${p}/`)
  )
  if (isAdminPath) {
    const role = request.cookies.get('lexis_user_role')?.value || ''
    const weight = ROLE_WEIGHT[role] || 0
    if (weight < 60) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      redirectUrl.search = ''
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  
  const isSuperPath = SUPERADMIN_ONLY.some(
    (p) => path === p || path.startsWith(`${p}/`)
  )
  if (isSuperPath) {
    const role = request.cookies.get('lexis_user_role')?.value || ''
    if (role !== 'Superadmin') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      redirectUrl.search = ''
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
