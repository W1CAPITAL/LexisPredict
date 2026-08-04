/**
 * CRM externo (outro projeto Supabase) — somente Superadmin
 * Credenciais via env no servidor (nunca no browser).
 *
 * Vercel / env:
 *   EXTERNAL_CRM_SUPABASE_URL=https://xxxx.supabase.co
 *   EXTERNAL_CRM_SUPABASE_KEY=service_role_ou_anon_com_rls
 */
'use server';

import { createClient } from '@supabase/supabase-js';
import { getUserContext } from '@/lib/server-db';
import { checkIfSuperAdmin } from '@/lib/supabase';

const DEFAULT_TABLES = [
  'empresas',
  'usuarios',
  'leads',
  'clientes',
  'gamificacao_conquistas',
] as const;

async function assertSuperAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.email) return { ok: false as const, error: 'Sessão expirada.' };
  if (!checkIfSuperAdmin({ cargo: ctx.cargo, role: ctx.cargo })) {
    return { ok: false as const, error: 'Acesso restrito a Superadmin.' };
  }
  return { ok: true as const, ctx };
}

function getExternalClient() {
  const url = process.env.EXTERNAL_CRM_SUPABASE_URL || process.env.WOLF_SUPABASE_URL;
  const key =
    process.env.EXTERNAL_CRM_SUPABASE_KEY ||
    process.env.EXTERNAL_CRM_SERVICE_ROLE_KEY ||
    process.env.WOLF_SUPABASE_KEY;

  if (!url || !key) {
    return {
      client: null as ReturnType<typeof createClient> | null,
      error:
        'Configure EXTERNAL_CRM_SUPABASE_URL e EXTERNAL_CRM_SUPABASE_KEY no Vercel (Environment Variables).',
    };
  }
  return {
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    error: null as string | null,
  };
}

export async function crmExternoStatusAction() {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, configured: false };

  const { client, error } = getExternalClient();
  if (!client) return { success: false, error: error!, configured: false };

  return {
    success: true,
    configured: true,
    tables: [...DEFAULT_TABLES],
    urlHost: (process.env.EXTERNAL_CRM_SUPABASE_URL || process.env.WOLF_SUPABASE_URL || '')
      .replace(/^https?:\/\//, '')
      .split('/')[0],
  };
}

export async function crmExternoListAction(table: string, limit = 50) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, data: [] as any[] };

  const { client, error } = getExternalClient();
  if (!client) return { success: false, error: error!, data: [] };

  const safeTable = String(table || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeTable) return { success: false, error: 'Tabela inválida', data: [] };

  try {
    const { data, error: qErr } = await client
      .from(safeTable)
      .select('*')
      .limit(Math.min(Math.max(limit, 1), 100));

    if (qErr) return { success: false, error: qErr.message, data: [] };
    return { success: true, data: data || [] };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha na consulta', data: [] };
  }
}

export async function crmExternoDeleteAction(table: string, id: string) {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const { client, error } = getExternalClient();
  if (!client) return { success: false, error: error! };

  const safeTable = String(table || '').replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeTable || !id) return { success: false, error: 'Parâmetros inválidos' };

  try {
    const { error: qErr } = await client.from(safeTable).delete().eq('id', id);
    if (qErr) return { success: false, error: qErr.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha ao apagar' };
  }
}
