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

// Estas rotas autenticam o agendador com seu segredo próprio no handler.
// A exceção é exata: outras rotas e subrotas continuam exigindo sessão.
const MACHINE_AUTH_API = new Set([
  '/api/cron/wa-movement',
  '/api/cron/wa-daily-return',
  '/api/cron/wa-full-portfolio',
  '/api/cron/wa-deep-closure',
  '/api/cron/experience-welcome',
  '/api/whatsapp-local/worker',
])

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
        "worker-src 'self' blob: https://cdn.jsdelivr.net",
        "child-src 'self' blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live https://api.ocr.space https://huggingface.co https://*.huggingface.co https://*.hf.co https://*.xethub.hf.co https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com https://comunicaapi.pje.jus.br",
        "frame-src 'self' blob: https://vercel.live",
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
  const isPublicApi = starts(path, PUBLIC_API) || MACHINE_AUTH_API.has(path)
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

  // Erro de consulta ou acesso restrito NÃO pode virar navegação automática
  // para /settings: mantém o endereço solicitado e falha de forma segura.
  const accessNotice = (
    status: number,
    code: string,
    title: string,
    description: string,
    allowSettings = false,
  ) => {
    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} · LexisPredict</title>
<style>body{margin:0;min-height:100vh;background:#f4f7fb;color:#182b47;font:16px system-ui,-apple-system,sans-serif;display:grid;place-items:center;padding:20px;box-sizing:border-box}
main{width:min(520px,100%);background:white;border:1px solid #dce5ef;border-radius:18px;padding:34px;box-shadow:0 10px 35px #0f1f3920}
h1{font-size:24px;line-height:1.25;margin:8px 0 14px}p{line-height:1.65;color:#4c6080}a{display:inline-block;text-decoration:none;background:#1764e8;color:white;border-radius:9px;padding:12px 17px;font-weight:650;margin:8px 8px 0 0}a.secondary{background:#edf2fa;color:#244466}small{color:#7788a0}</style></head>
<body><main><small>LexisPredict · Código ${code}</small><h1>${title}</h1>
<p>${description}</p><a href="">Tentar novamente</a>${allowSettings ? '<a class="secondary" href="/settings">Ver assinatura</a>' : ''}
</main></body></html>`
    const next = copyAuthCookies(new NextResponse(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Lexis-Access-Reason': code,
        ...(status === 503 ? { 'Retry-After': '3' } : {}),
      },
    }))
    return applySecurityHeaders(next)
  }
  const retryDelay = () => new Promise<void>((resolve) => setTimeout(resolve, 120))

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
      const readProfile = () => client
        .from('usuarios')
        .select('cargo, role, empresa_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      let profileResult = await readProfile()
      if (profileResult.error) {
        await retryDelay()
        profileResult = await readProfile()
      }
      const { data: profile, error: profileError } = profileResult

      if (profileError) {
        console.warn('[middleware] profile_lookup_failed', profileError.code || 'unknown')
        return isApi
          ? json({ ok: false, error: 'tenant_profile_lookup_failed' }, 503)
          : accessNotice(503, 'profile_lookup_failed',
              'Não foi possível validar seu perfil',
              'A consulta ao banco falhou temporariamente. Sua conta não foi alterada. Tente novamente nesta mesma página.')
      }
      if (!profile) {
        // Somente ausência CONFIRMADA do perfil deve abrir o cadastro inicial.
        if (isTenantSetupPage || path.startsWith('/settings')) {
          response.headers.set('Cache-Control', 'private, no-store')
          return applySecurityHeaders(response)
        }
        return isApi
          ? json({ ok: false, error: 'tenant_profile_missing' }, 403)
          : redirect('/setup-empresa')
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

        const readEmpresa = () => client
          .from('empresas')
          .select('plano, plano_expira_em, plano_bloqueado, billing_status, onboarding_completed')
          .eq('id', empresaId)
          .maybeSingle()
        let fullEmpresa = await readEmpresa()
        // Não transformar uma falha transitória de rede/PostgREST em
        // "assinatura bloqueada". Tentar uma segunda leitura controlada.
        const missingLegacyColumns = (message?: string) =>
          /billing_status|onboarding_completed|column .* does not exist/i.test(String(message || ''))
        if (fullEmpresa.error && !missingLegacyColumns(fullEmpresa.error.message)) {
          await retryDelay()
          fullEmpresa = await readEmpresa()
        }
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
          console.warn('[middleware] tenant_lookup_failed', empresaError.code || 'unknown')
          return isApi
            ? json({ ok: false, error: 'tenant_lookup_failed' }, 503)
            : accessNotice(503, 'tenant_lookup_failed',
                'Não foi possível confirmar a assinatura',
                'O Supabase não respondeu à consulta da empresa. Isso não confirma bloqueio ou vencimento. Sua página foi preservada; tente novamente.')
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
          if (!billingActive) return accessNotice(403, 'subscription_not_active',
            'Assinatura ainda não ativada',
            'Esta etapa fica disponível após a ativação da assinatura. Consulte a situação do plano sem perder o endereço atual.', true)
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
          const reason = blocked ? 'subscription_blocked' : 'subscription_expired'
          return isApi
            ? json({ ok: false, error: reason }, 402)
            : accessNotice(402, reason,
                blocked ? 'Acesso restrito pela assinatura' : 'Assinatura expirada',
                'O servidor confirmou uma restrição real na assinatura desta empresa. A página solicitada não será exibida enquanto o acesso estiver restrito.', true)
        }

        const awaitingActivation = billingStatus === 'pending'
        // Plano Máximo já representa entitlement completo. Um billing_status
        // legado/pending não pode esconder todas as abas quando a empresa não
        // está bloqueada nem expirada.
        if (awaitingActivation && plan !== 'maximo' && !billingBypass) {
          return isApi
            ? json({ ok: false, error: 'subscription_pending' }, 402)
            : accessNotice(402, 'subscription_pending',
                'Assinatura pendente de ativação',
                'A assinatura desta empresa ainda está pendente de confirmação. Verifique o plano antes de acessar a área restrita.', true)
        }

        if (!isApi && !billingBypass && !hrefLiberado(path, plan)) {
          return accessNotice(403, 'plan_required',
            'Área não incluída no plano atual',
            'Esta área exige um pacote que não está habilitado para a empresa. Nenhuma configuração ou cobrança foi alterada.', true)
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
