import { UserRole } from '@/lib/supabase';

/**
 * ROLE WEIGHTS + guards de cargo (F1).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

export const ROLE_WEIGHTS: Record<UserRole, number> = {
  'Superadmin': 100,
  'Supervisor': 80,
  'Administrador': 60,
  'Operador': 40,
  'Visualizador': 20,
};

export function getCargoWeight(cargo?: UserRole | string | null): number {
  if (!cargo) return 0;
  return ROLE_WEIGHTS[cargo as UserRole] ?? 0;
}

/** Admin group: Administrador (60+), Supervisor (80), Superadmin (100). */
export function isAdminGroup(cargo?: UserRole | string | null): boolean {
  return getCargoWeight(cargo) >= 60;
}

/** Master view: Supervisor ou Superadmin. */
export function isMasterView(cargo?: UserRole | string | null): boolean {
  return cargo === 'Supervisor' || cargo === 'Superadmin';
}
