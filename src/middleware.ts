/**
 * Guarda admin + superadmin. Middleware efetivo: /middleware.ts (raiz).
 */
import { NextRequest, NextResponse } from 'next/server'

const ROLE_WEIGHT: Record<string, number> = {
  Superadmin: 100,
  Supervisor: 80,
  Administrador: 60,
  Operador: 40,
  Visualizador: 20,
}

const ADMIN_ONLY = ['/supervisao', '/auditoria', '/team']
const SUPERADMIN_ONLY = ['/security']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isSuperPath = SUPERADMIN_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (isSuperPath) {
    const role = req.cookies.get('lexis_user_role')?.value || ''
    if (role !== 'Superadmin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  const isAdminPath = ADMIN_ONLY.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!isAdminPath) return NextResponse.next()

  const role = req.cookies.get('lexis_user_role')?.value || ''
  if ((ROLE_WEIGHT[role] || 0) < 60) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/supervisao/:path*',
    '/auditoria/:path*',
    '/team/:path*',
    '/security/:path*',
  ],
}
