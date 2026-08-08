import { NextRequest, NextResponse } from 'next/server';

/**
 * F1 — Guarda de rotas por cargo (middleware).
 * Rotas administrativas só acessíveis a Administrador/Supervisor/Superadmin.
 * O cookie lexis_user_role é gravado pelo AuthProvider após carregar o perfil.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

const ROLE_WEIGHT: Record<string, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
};

const ADMIN_ONLY = ['/supervisao', '/auditoria', '/team'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPath = ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isAdminPath) return NextResponse.next();

  const role = req.cookies.get('lexis_user_role')?.value || '';
  const weight = ROLE_WEIGHT[role] || 0;
  if (weight < 60) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/supervisao/:path*', '/auditoria/:path*', '/team/:path*'],
};
