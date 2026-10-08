/**
 * LexisPredict Commercial — middleware SaaS
 * Supabase Auth + tenant/billing gate + ACL + headers de segurança.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hrefLiberado, normalizePlanId, pacotesDoPlano } from '@/lib/planos-pacotes'
import { operatorRouteAllowed, resolveRole } from '@/lib/roles'

const ROLE_WEIGHT: Record<string, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
}

const SUPERVISOR_ONLY = ['/supervisao', '/auditoria', '/team']
const SUPERADMIN_ONLY = ['/security', '/superadmin', '/ops']

const PUBLIC_API = [
  '/api/auth/login',
  '/api/health',
  '/api/version',
  '/api/commercial/health',
  '/api/integration/sheetspredict',
  '/api/integration/wa-auto/auth',
  '/api/webhook',
  '/api/webhooks',
]

const OPERATIONAL_API = [
  '/api/datajud-search',
  '/api/datajud-status',
  '/api/datajud-trigger',
  '/api/datajud-worker',
  '/api/djen-proxy',
  '/api/scan-health',
  '/api/queue',
]

const FINANCIAL_API = ['/api/crm']

function starts(path: string, roots: string[]) {
  return roots.some((root) => path === root || path.startsWith(`${root}/`))
}

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
        "child-src 'self' blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live https://api.ocr.space https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com https://comunicaapi.pje.jus.br",
        "frame-src 'self' blob:",
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
  let response = NextResponse.next({ request })
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')
  const isAuthPage = path === '/login' || path === '/signup'
  const isTenantSetupPage = path === '/setup-empresa'
  const isFirstRunPage = path === '/primeiro-acesso'
  const isStaticFile = /\.[a-z0-9]+$/i.test(path)
  const isPublicApi = starts(path, PUBLIC_API)
  const isPublic = isAuthPage || path.startsWith('/termos') || path === '/modo-seguranca' || isPublicApi || isStaticFile
  const isGuest = request.cookies.get('lexis_guest')?.value === '1'

  if (isGuest && !isAuthPage) {
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Lexis-Guest', '1')
    return applySecurityHeaders(response)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const copyAuthCookies = (target: NextResponse) => {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie)
    return target
  }

  const json = (body: unknown, status: number) =>
    applySecurityHeaders(copyAuthCookies(NextResponse.json(body, { status })))

  const redirect = (pathname: string) => {
    const target = request.nextUrl.clone()
    target.pathname = pathname
    target.search = ''
    const next = copyAuthCookies(NextResponse.redirect(target))
    next.headers.set('Cache-Control', 'private, no-store')
    return applySecurityHeaders(next)
  }

  if (!url || !key) {
    if (isPublic) return applySecurityHeaders(response)
    if (isApi) return json({ ok: false, error: 'supabase_not_configured' }, 503)
    return redirect('/login')
  }

  if (!isPublic || isAuthPage) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          const previous = response.cookies.getAll()
          response = NextResponse.next({ request })
          for (const cookie of previous) response.cookies.set(cookie)
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    })

    let user: { id?: string } | null = null
    try {
      const got = await client.auth.getUser()
      user = got.data?.user ?? null
    } catch {
      user = null
    }

    if (!user && !isPublic) {
      return isApi ? json({ ok: false, error: 'unauthenticated' }, 401) : redirect('/login')
    }
    if (user && isAuthPage) return redirect('/')

    if (user?.id) {
      const { data: profile, error: profileError } = await client
        .from('usuarios')
        .select('cargo, role, empresa_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (profileError || !profile) {
        // Nunca redirecionar uma rota para ela mesma. Em falha transitória do
        // lookup, /setup-empresa e /settings precisam continuar acessíveis
        // para diagnóstico/recuperação em vez de entrar em loop 30x.
        if (isTenantSetupPage || path.startsWith('/settings')) {
          response.headers.set('Cache-Control', 'private, no-store')
          if (profileError) response.headers.set('X-Lexis-Auth-Warning', 'profile_lookup_failed')
          return applySecurityHeaders(response)
        }
        if (isApi) {
          return json(
            { ok: false, error: profileError ? 'tenant_profile_lookup_failed' : 'tenant_profile_missing' },
            profileError ? 503 : 403
          )
        }
        return redirect('/setup-empresa')
      }

      const role = resolveRole({ cargo: profile.cargo, role: (profile as any).role })
      const isSuperAdmin = role === 'Superadmin'
      if (isTenantSetupPage && isSuperAdmin) return redirect('/')
      const supervisorPath = starts(path, SUPERVISOR_ONLY)
      const superPath = starts(path, SUPERADMIN_ONLY)
      const roleWeight = ROLE_WEIGHT[role] || 0

      if ((superPath && !isSuperAdmin) || (supervisorPath && roleWeight < ROLE_WEIGHT.Supervisor)) {
        return isApi ? json({ ok: false, error: 'forbidden' }, 403) : redirect('/')
      }

      // Operador usa somente o conjunto operacional essencial.
      if (role === 'Operador') {
        if (!isApi && !operatorRouteAllowed(path)) {
          return redirect('/cases')
        }
        if (isApi && (starts(path, OPERATIONAL_API) || starts(path, FINANCIAL_API))) {
          return json({ ok: false, error: 'role_required', required: 'Administrador' }, 403)
        }
      }

      if (!isSuperAdmin) {
        const empresaId = String(profile.empresa_id || '')
        if (!empresaId) {
          if (isTenantSetupPage) {
            response.headers.set('Cache-Control', 'private, no-store')
            return applySecurityHeaders(response)
          }
          return isApi ? json({ ok: false, error: 'tenant_missing' }, 403) : redirect('/setup-empresa')
        }

        let empresa: any = null
        let empresaError: any = null
        let legacyCommercialSchema = false

        const fullEmpresa = await client
          .from('empresas')
          .select('plano, plano_expira_em, plano_bloqueado, billing_status, onboarding_completed')
          .eq('id', empresaId)
          .maybeSingle()

        empresa = fullEmpresa.data
        empresaError = fullEmpresa.error

        // Compatibilidade com o banco legado da W1: instalações anteriores ao
        // módulo comercial não possuem billing_status/onboarding_completed.
        if (empresaError && /billing_status|onboarding_completed|column .* does not exist/i.test(String(empresaError.message || ''))) {
          legacyCommercialSchema = true
          const legacyEmpresa = await client
            .from('empresas')
            .select('plano, plano_expira_em, plano_bloqueado')
            .eq('id', empresaId)
            .maybeSingle()
          empresa = legacyEmpresa.data
          empresaError = legacyEmpresa.error
        }

        if (empresaError) {
          if (isApi) return json({ ok: false, error: 'tenant_lookup_failed' }, 503)
          if (path.startsWith('/settings')) {
            response.headers.set('Cache-Control', 'private, no-store')
            response.headers.set('X-Lexis-Auth-Warning', 'tenant_lookup_failed')
            return applySecurityHeaders(response)
          }
          return redirect('/settings')
        }
        if (!empresa) {
          if (isTenantSetupPage) {
            response.headers.set('Cache-Control', 'private, no-store')
            return applySecurityHeaders(response)
          }
          return isApi ? json({ ok: false, error: 'tenant_not_found' }, 409) : redirect('/setup-empresa')
        }
        if (isTenantSetupPage) return redirect('/')

        const plan = normalizePlanId(empresa.plano || 'essencial')
        const billingStatus = legacyCommercialSchema
          ? 'active'
          : String(empresa.billing_status || '').toLowerCase()
        const billingActive = legacyCommercialSchema ? true : billingStatus === 'active'

        if (!legacyCommercialSchema && billingActive && !empresa.onboarding_completed) {
          if (!isFirstRunPage) return redirect('/primeiro-acesso')
          response.headers.set('Cache-Control', 'private, no-store')
          return applySecurityHeaders(response)
        }

        if (isFirstRunPage) {
          if (!billingActive) return redirect('/settings')
          return redirect('/')
        }

        const exp = empresa.plano_expira_em ? new Date(empresa.plano_expira_em).getTime() : null
        // No schema legado, Máximo é entitlement completo. Datas antigas de
        // renovação eram informativas e não devem bloquear o gabinete.
        const expired =
          !(legacyCommercialSchema && plan === 'maximo') &&
          exp !== null &&
          Number.isFinite(exp) &&
          exp < Date.now()
        const blocked = Boolean(empresa.plano_bloqueado) || ['past_due', 'suspended', 'canceled'].includes(billingStatus)
        const billingBypass = path.startsWith('/settings') || path === '/api/commercial/me'

        if ((blocked || expired) && !billingBypass) {
          return isApi
            ? json({ ok: false, error: blocked ? 'subscription_blocked' : 'subscription_expired' }, 402)
            : redirect('/settings')
        }

        const awaitingActivation = billingStatus === 'pending'
        // Plano Máximo já representa entitlement completo. Um billing_status
        // legado/pending não pode esconder todas as abas quando a empresa não
        // está bloqueada nem expirada.
        if (awaitingActivation && plan !== 'maximo' && !billingBypass) {
          return isApi
            ? json({ ok: false, error: 'subscription_pending' }, 402)
            : redirect('/settings')
        }

        if (!isApi && !billingBypass && !hrefLiberado(path, plan)) {
          return redirect('/settings')
        }

        if (isApi && !billingBypass) {
          const packs = pacotesDoPlano(plan)
          if (starts(path, OPERATIONAL_API) && !packs.includes('operacional')) {
            return json({ ok: false, error: 'plan_required', package: 'operacional' }, 403)
          }
          if (starts(path, FINANCIAL_API) && !packs.includes('financeiro')) {
            return json({ ok: false, error: 'plan_required', package: 'financeiro' }, 403)
          }
        }
      }
    }

    response.headers.set('Cache-Control', 'private, no-store')
  }

  return applySecurityHeaders(response)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
