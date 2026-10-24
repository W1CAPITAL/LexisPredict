'use server';

import { getEmpresaUsers, getSupabaseAdmin, getUserContext } from '@/lib/server-db';

export type AssignableUser = {
  id: string;
  auth_user_id: string;
  nome: string;
  email?: string;
  cargo?: string;
};

/** Lista usuários da própria empresa para reatribuição colaborativa em /processos. */
export async function listAssignableUsersAction(): Promise<AssignableUser[]> {
  const ctx = await getUserContext();
  if (!ctx.empresa_id || !ctx.auth_id) return [];

  const db = await getSupabaseAdmin();
  const {data:users,error}=await db.from('usuarios')
    .select('id,auth_user_id,nome,email,cargo')
    .eq('empresa_id',ctx.empresa_id)
    .not('auth_user_id','is',null)
    .order('nome',{ascending:true});
  if(error)throw new Error('Não foi possível consultar responsáveis desta empresa.');
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
  const ctx = await getUserContext();
  if (!ctx.empresa_id || (!ctx.isSupervisor && !ctx.isSuperAdmin)) return [];
  const users = await getEmpresaUsers();
  return users || [];
}
