/**
 * LexisPredict — middleware unificado
 * Sessão Supabase + headers de segurança + ACL de rotas.
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
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  if (!res.headers.has('Content-Security-Policy')) {
    res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://vercel.live https://cdn.jsdelivr.net https://www.highrevenueformat.com https://www.highperformanceformat.com https://www.profitableratecpmnetwork.com https://*.profitableratecpmnetwork.com https://pl31113566.profitableratecpmnetwork.com https://pl31113976.profitableratecpmnetwork.com",
        "worker-src 'self' blob:",
        "child-src 'self' blob: https://www.highrevenueformat.com https://www.highperformanceformat.com https://www.profitableratecpmnetwork.com https://*.profitableratecpmnetwork.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.groq.com https://api.anthropic.com https://openrouter.ai https://*.vercel.app https://vercel.live https://api.ocr.space https://cdn.jsdelivr.net https://unpkg.com https://tessdata.projectnaptha.com https://comunicaapi.pje.jus.br https://www.highrevenueformat.com https://www.highperformanceformat.com https://www.profitableratecpmnetwork.com https://*.profitableratecpmnetwork.com https://pl31113566.profitableratecpmnetwork.com https://pl31113976.profitableratecpmnetwork.com",
        "frame-src 'self' blob: https://www.highrevenueformat.com https://www.highperformanceformat.com https://www.profitableratecpmnetwork.com https://*.profitableratecpmnetwork.com https://*.highrevenueformat.com",
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
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isAuthPage = path === '/login' || path === '/signup';
  const isPublic =
    isAuthPage ||
    path.startsWith('/termos') ||
    path.startsWith('/api/') ||
    path.startsWith('/modo-seguranca') ||
    /\.[a-z0-9]+$/i.test(path);
  const safetyOn = request.cookies.get('lexis_safety')?.value === '1';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const redirect = (pathname: string) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = '';
    const next = NextResponse.redirect(target);
    // Refresh cookies must also reach redirects (Safari/PWA included).
    for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
    next.headers.set('Cache-Control', 'private, no-store');
    return applySecurityHeaders(next);
  };
  if (safetyOn) {
    if (isAuthPage) return redirect("/modo-seguranca");
    response.headers.set("Cache-Control", "private, no-store");
    return applySecurityHeaders(response);
  }
  if (url && key && (!isPublic || isAuthPage)) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          const previous = response.cookies.getAll();
          response = NextResponse.next({ request });
          for (const cookie of previous) response.cookies.set(cookie);
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    let user: { id?: string } | null = null;
    try {
      const got = await client.auth.getUser();
      user = got.data?.user ?? null;
    } catch {
      user = null;
    }
    if (!user && !isPublic) return redirect('/login');
    if (user && isAuthPage) return redirect('/');
    const adminPath = ADMIN_ONLY.some(p => path === p || path.startsWith(`${p}/`));
    const superPath = [...SUPERADMIN_ONLY, '/superadmin', '/ops'].some(p => path === p || path.startsWith(`${p}/`));
    if (user && (adminPath || superPath)) {
      const { data: profile } = await client.from('usuarios').select('cargo').eq('auth_user_id', user.id).maybeSingle();
      const role = profile?.cargo || '';
      if ((superPath && role !== 'Superadmin') || (adminPath && (ROLE_WEIGHT[role] || 0) < 60)) return redirect('/');
    }
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
