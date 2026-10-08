import { resolveRole, type EffectiveRole } from '@/lib/roles';

/**
 * W1 legacy: usuarios.role is usually "operador", including the Superadmin
 * account. The editable, verified usuarios.cargo is the authoritative role.
 * Fall back to role only if cargo is absent/unrecognised.
 */
export function resolveWaAutoPermissions(profile: {
  cargo?: string | null;
  role?: string | null;
} | null | undefined): { role: EffectiveRole; canManage: boolean } {
  const roleFromCargo = resolveRole(profile?.cargo);
  const role = roleFromCargo !== 'Desconhecido'
    ? roleFromCargo
    : resolveRole(profile?.role);
  return {
    role,
    canManage: role === 'Superadmin' || role === 'Supervisor' || role === 'Administrador',
  };
}
