/**
 * @fileOverview Operações de dados — somente Superadmin autenticado
 * Usuários, processos (dados) e empresas — com confirmação na UI.
 */
'use server';

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { checkIfSuperAdmin } from '@/lib/supabase';

const ALLOWED_TABLES = [
  'processos',
  'usuarios',
  'empresas',
  'advogados_banca',
] as const;

export type OpsTable = (typeof ALLOWED_TABLES)[number];

function isAllowed(table: string): table is OpsTable {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}

/** Coluna de PK usada no delete/update */
function pkColumn(table: string): string {
  return 'id';
}

async function assertSuperAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.email) {
    return { ok: false as const, error: 'Sessão expirada. Faça login novamente.' };
  }
  const allowed = checkIfSuperAdmin({ cargo: ctx.cargo, role: ctx.cargo });
  if (!allowed) {
    return { ok: false as const, error: 'Acesso restrito a Superadmin.' };
  }
  return { ok: true as const, ctx };
}

export async function opsListTables() {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, tables: [] as string[] };
  return { success: true, tables: [...ALLOWED_TABLES] };
}

export async function opsListRows(table: string, limit = 100, search?: string) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, data: [] as any[] };
  if (!isAllowed(table)) return { success: false, error: 'Tabela não permitida.', data: [] };

  try {
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from(table)
      .select('*')
      .limit(Math.min(Math.max(limit, 1), 250));

    if (error) return { success: false, error: error.message, data: [] };

    let rows = data || [];
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      rows = rows.filter((r: any) => JSON.stringify(r).toLowerCase().includes(s));
    }
    return { success: true, data: rows };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao listar', data: [] };
  }
}

export async function opsDeleteRow(table: string, id: string) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isAllowed(table)) return { success: false, error: 'Tabela não permitida.' };
  if (!id) return { success: false, error: 'ID inválido.' };

  // Bloqueio leve: não apagar o próprio usuário logado
  if (table === 'usuarios' && gate.ctx.auth_id && id === gate.ctx.auth_id) {
    return { success: false, error: 'Não é permitido apagar o próprio usuário logado por este painel.' };
  }

  try {
    const admin = await getSupabaseAdmin();
    const col = pkColumn(table);
    const { error } = await admin.from(table).delete().eq(col, id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao apagar' };
  }
}

export async function opsUpsertRow(table: string, row: Record<string, unknown>) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!isAllowed(table)) return { success: false, error: 'Tabela não permitida.' };
  if (!row || typeof row !== 'object') return { success: false, error: 'Payload inválido.' };

  try {
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin.from(table).upsert(row).select().maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao salvar' };
  }
}
