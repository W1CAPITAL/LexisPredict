/**
 * LexisPredict — middleware de sessão Supabase + segurança + ACL.
 * Compatível com @supabase/ssr atual: usa exclusivamente getAll/setAll.
 */
import { createServerClient } from '@supabase/ssr'
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
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  if (!res.headers.has('Content-Security-Policy')) {
    res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live https://cdn.jsdelivr.net",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live https://api.ocr.space https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com",
        "frame-src 'self' blob: https://*.highrevenueformat.com https://www.highrevenueformat.com https://www.profitableratecpmnetwork.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; '),
    )
  }

  return res
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const path = request.nextUrl.pathname
  const isPublicFile =
    /\.(.*)$/.test(path) ||
    path.startsWith('/api') ||
    path.includes('manifest.json') ||
    path.includes('favicon.ico')

  // Pequeno rate limit para login/signup, sem interferir nas demais rotas.
  if (path === '/login' || path === '/signup') {
    const hits = Number(request.cookies.get('lexis_login_hits')?.value || '0')
    const maxHits = request.method === 'POST' ? 25 : 60
    if (hits > maxHits) {
      const blocked = NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos.' },
        { status: 429 },
      )
      blocked.cookies.set('lexis_login_hits', String(hits), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60,
        path: '/',
      })
      return applySecurityHeaders(blocked)
    }
    if (request.method === 'POST') {
      response.cookies.set('lexis_login_hits', String(hits + 1), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60,
        path: '/',
      })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key && !isPublicFile) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
          })

          response = NextResponse.next({
            request: { headers: request.headers },
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
              httpOnly: options.httpOnly ?? true,
              sameSite: options.sameSite ?? 'lax',
              secure: process.env.NODE_ENV === 'production' ? true : options.secure,
            })
          })
        },
      },
    })

    let user = null
    try {
      const result = await supabase.auth.getUser()
      user = result.data.user
    } catch {
      // Falha de auth não pode quebrar o restante do app; a página poderá
      // redirecionar para login pelo estado de usuário abaixo.
      user = null
    }

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

  const isAdminPath = ADMIN_ONLY.some((p) => path === p || path.startsWith(`${p}/`))
  if (isAdminPath) {
    const role = request.cookies.get('lexis_user_role')?.value || ''
    if ((ROLE_WEIGHT[role] || 0) < 60) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      redirectUrl.search = ''
      return applySecurityHeaders(NextResponse.redirect(redirectUrl))
    }
  }

  const isSuperPath = SUPERADMIN_ONLY.some((p) => path === p || path.startsWith(`${p}/`))
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
