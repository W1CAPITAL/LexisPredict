/**
 * Middleware complementar (matcher restrito).
 * Headers de segurança + guarda de cargo.
 * A lógica completa de sessão fica em /middleware.ts (raiz).
 */
import { NextResponse, type NextRequest } from "next/server";

const ROLE_WEIGHT: Record<string, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
};

const ADMIN_ONLY = ["/supervisao", "/auditoria", "/team"];
const SUPERADMIN_ONLY = ["/security"];

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  if (!res.headers.has("Content-Security-Policy")) {
    res.headers.set(
      "Content-Security-Policy",
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
      ].join("; ")
    );
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isSuperPath = SUPERADMIN_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isSuperPath) {
    const role = req.cookies.get("lexis_user_role")?.value || "";
    if (role !== "Superadmin") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return applySecurityHeaders(NextResponse.redirect(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  const isAdminPath = ADMIN_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isAdminPath) return applySecurityHeaders(NextResponse.next());

  const role = req.cookies.get("lexis_user_role")?.value || "";
  if ((ROLE_WEIGHT[role] || 0) < 60) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return applySecurityHeaders(NextResponse.redirect(url));
  }
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/supervisao/:path*",
    "/auditoria/:path*",
    "/team/:path*",
    "/security/:path*",
  ],
};
