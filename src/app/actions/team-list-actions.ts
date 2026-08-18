'use server';

import { getEmpresaUsers, getUserContext } from '@/lib/server-db';

export type AssignableUser = {
  id: string;
  auth_user_id: string;
  nome: string;
  email?: string;
  cargo?: string;
};

/** Lista usuários da empresa para Supervisor/Superadmin/Administrador atribuir o contrato. */
export async function listAssignableUsersAction(): Promise<AssignableUser[]> {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const cargo = String(ctx.cargo || '');
  const can =
    ctx.isSuperAdmin ||
    ctx.isSupervisor ||
    /administrador|supervisor|superadmin|admin/i.test(cargo);

  if (!can) return [];

  const users = await getEmpresaUsers();
  return (users || [])
    .filter((u: any) => u?.auth_user_id)
    .map((u: any) => ({
      id: String(u.id),
      auth_user_id: String(u.auth_user_id),
      nome: String(u.nome || u.email || 'Sem nome').toUpperCase(),
      email: u.email ? String(u.email) : undefined,
      cargo: u.cargo ? String(u.cargo) : undefined,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}


/** Lista completa (inclui avatar_url) para UI de equipe/supervisão. */
export async function getEmpresaUsersAction() {
  const users = await getEmpresaUsers();
  return users || [];
}
