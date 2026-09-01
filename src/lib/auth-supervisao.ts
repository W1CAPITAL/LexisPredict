/**
 * Regras de supervisão — única fonte para UI e server actions.
 *
 * Supervisor / Superadmin:
 *  - Rodar empresa (scanner em lote)
 *  - Reabrir fila
 *  - Transferir / reatribuir dono (created_by)
 *  - Distribuir carteira
 *
 * Administrador: operação normal, NÃO controla carteira inteira nem scanner empresarial.
 * Operador: só seu escopo.
 */

export type ProfileLike = {
  cargo?: string | null;
  role?: string | null;
  perfil?: string | null;
  isSuperAdmin?: boolean;
  isSupervisor?: boolean;
} | null | undefined;

function blob(p: ProfileLike): string {
  if (!p) return "";
  return `${p.cargo || ""} ${p.role || ""} ${p.perfil || ""}`.toLowerCase();
}

/** Superadmin (cargo/role ou flag). */
export function isSuperAdminProfile(p: ProfileLike): boolean {
  if (!p) return false;
  if (p.isSuperAdmin) return true;
  const b = blob(p);
  return /super\s*admin|superadmin/.test(b);
}

/** Supervisor (não inclui Administrador). */
export function isSupervisorProfile(p: ProfileLike): boolean {
  if (!p) return false;
  if (p.isSupervisor) return true;
  if (isSuperAdminProfile(p)) return true;
  const b = blob(p);
  // superadmin já retornou true acima
  return /\bsupervisor\b/.test(b);
}

/**
 * Pode rodar operações de escala empresarial:
 * scanner "Rodar empresa", reabrir fila, transferir dono.
 */
export function canSupervisaoCarteira(p: ProfileLike): boolean {
  return isSupervisorProfile(p) || isSuperAdminProfile(p);
}

/** Alias explícito para UI. */
export function canRodarEmpresaScan(p: ProfileLike): boolean {
  return canSupervisaoCarteira(p);
}

export function canAssignOwner(p: ProfileLike): boolean {
  return canSupervisaoCarteira(p);
}

/** Mensagem padrão de recusa. */
export const SUPERVISAO_REQUIRED =
  "Somente Supervisor ou Superadmin pode executar esta operação.";
