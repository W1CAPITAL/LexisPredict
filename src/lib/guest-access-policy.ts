/**
 * Política mínima para a demonstração sem sessão Supabase.
 * O cookie lexis_guest é um pedido de prévia visual, NUNCA uma credencial.
 * APIs, server actions e áreas administrativas continuam exigindo autenticação.
 * Páginas pré-visualizadas também devem verificar autorização em toda leitura
 * de dados no servidor: este filtro não substitui a checagem nos handlers.
 */
export type GuestAccessDecision = "standard" | "preview" | "blocked-api" | "blocked-write" | "blocked-page";

const RESTRICTED_PAGES = [
  "/supervisao", "/auditoria", "/team", "/report/completo",
  "/projetos", "/hermes-3d", "/security", "/superadmin", "/ops",
  "/settings", "/setup-empresa", "/primeiro-acesso",
];

function matchesRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(root + "/");
}

export function guestAccessDecision(
  path: string,
  method: string,
  isPublic: boolean,
): GuestAccessDecision {
  if (isPublic) return "standard";
  if (method.toUpperCase() !== "GET") return "blocked-write";
  if (path === "/api" || path.startsWith("/api/")) return "blocked-api";
  if (RESTRICTED_PAGES.some((root) => matchesRoot(path, root))) return "blocked-page";
  return "preview";
}
