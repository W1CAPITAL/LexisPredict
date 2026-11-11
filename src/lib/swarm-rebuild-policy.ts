const EXCLUDED_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/api',
  '/setup-empresa',
  '/setup-planilha',
  '/primeiro-acesso',
  '/modo-seguranca',
  '/desktop',
];

export function shouldPlaySwarmRebuild(pathname: string, visited: Set<string>): boolean {
  const path = String(pathname || '/').split('?')[0] || '/';
  if (EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'))) return false;
  if (visited.has(path)) return false;
  visited.add(path);
  return true;
}
