/**
 * CRM externo (outro projeto Supabase) — somente Superadmin
 * Credenciais via env no servidor (nunca no browser).
 *
 * Vercel:
 *   EXTERNAL_CRM_SUPABASE_URL=https://lwfvjnmegifgqkydzvmk.supabase.co
 *   EXTERNAL_CRM_SUPABASE_KEY=<anon ou service_role, JWT completo, sem aspas>
 */
'use server';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUserContext } from '@/lib/server-db';
import { checkIfSuperAdmin } from '@/lib/supabase';

const DEFAULT_TABLES = [
  'empresas',
  'usuarios',
  'leads',
  'clientes',
  'gamificacao_conquistas',
] as const;

/** Limpa URL/key coladas no Vercel (aspas, Bearer, espaços, quebra de linha) */
function cleanEnv(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(s)) {
    s = s.replace(/^bearer\s+/i, '').trim();
  }
  s = s.replace(/\r?\n/g, '').trim();
  return s;
}

function cleanUrl(raw: string | undefined | null): string {
  let u = cleanEnv(raw);
  u = u.replace(/\/+$/, '');
  const restIdx = u.indexOf('/rest/v1');
  if (restIdx > 0) u = u.slice(0, restIdx);
  return u;
}

async function assertSuperAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.email) return { ok: false as const, error: 'Sessão expirada.' };
  if (!checkIfSuperAdmin({ cargo: ctx.cargo, role: ctx.cargo })) {
    return { ok: false as const, error: 'Acesso restrito a Superadmin.' };
  }
  return { ok: true as const, ctx };
}

function getExternalClient(): {
  client: SupabaseClient | null;
  error: string | null;
  urlHost: string;
  keyPreview: string;
} {
  const url = cleanUrl(
    process.env.EXTERNAL_CRM_SUPABASE_URL || process.env.WOLF_SUPABASE_URL
  );
  const key = cleanEnv(
    process.env.EXTERNAL_CRM_SUPABASE_KEY ||
      process.env.EXTERNAL_CRM_SERVICE_ROLE_KEY ||
      process.env.WOLF_SUPABASE_KEY
  );

  const urlHost = url.replace(/^https?:\/\//, '').split('/')[0] || '';
  const keyPreview =
    key.length > 12 ? `${key.slice(0, 8)}…${key.slice(-6)}` : key ? '(curta)' : '(vazia)';

  if (!url || !key) {
    return {
      client: null,
      error:
        'Env ausente. No Vercel: EXTERNAL_CRM_SUPABASE_URL e EXTERNAL_CRM_SUPABASE_KEY (depois Redeploy).',
      urlHost,
      keyPreview,
    };
  }

  if (!url.startsWith('https://') || !url.includes('supabase.co')) {
    return {
      client: null,
      error: `URL inválida (${urlHost || url}). Use https://SEU_REF.supabase.co sem /rest/v1.`,
      urlHost,
      keyPreview,
    };
  }

  if (!key.startsWith('eyJ')) {
    return {
      client: null,
      error:
        'KEY não parece JWT (deve começar com eyJ). Não use Bearer nem aspas. Copie anon/service_role em Settings → API.',
      urlHost,
      keyPreview,
    };
  }

  if (key.split('.').length !== 3) {
    return {
      client: null,
      error: 'KEY incompleta (JWT deve ter 3 partes separadas por ponto). Cole o token inteiro.',
      urlHost,
      keyPreview,
    };
  }

  return {
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    error: null,
    urlHost,
    keyPreview,
  };
}

export async function crmExternoStatusAction() {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, configured: false };

  const { client, error, urlHost, keyPreview } = getExternalClient();
  if (!client) {
    return { success: false, error: error!, configured: false, urlHost, keyPreview };
  }

  try {
    const { error: probeErr } = await client.from('empresas').select('id').limit(1);

    if (probeErr) {
      const msg = probeErr.message || String(probeErr);
      if (/invalid api key/i.test(msg)) {
        return {
          success: false,
          configured: false,
          urlHost,
          keyPreview,
          error:
            'Invalid API key no CRM. Confira: (1) key do projeto ' +
            urlHost +
            ' (2) sem aspas no Vercel (3) Redeploy após salvar env (4) prefira service_role se anon falhar.',
        };
      }
      if (/relation|does not exist|permission|row-level|rls/i.test(msg)) {
        return {
          success: true,
          configured: true,
          tables: [...DEFAULT_TABLES],
          urlHost,
          keyPreview,
          warning: msg,
        };
      }
      return { success: false, configured: true, urlHost, keyPreview, error: msg };
    }
  } catch (e: any) {
    return {
      success: false,
      configured: false,
      urlHost,
      keyPreview,
      error: e?.message || 'Falha ao testar CRM externo',
    };
  }

  return {
    success: true,
    configured: true,
    tables: [...DEFAULT_TABLES],
    urlHost,
    keyPreview,
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

    if (qErr) {
      const msg = qErr.message || '';
      if (/invalid api key/i.test(msg)) {
        return {
          success: false,
          error:
            'Invalid API key — revise EXTERNAL_CRM_SUPABASE_KEY no Vercel (sem aspas) e faça Redeploy.',
          data: [],
        };
      }
      return { success: false, error: msg, data: [] };
    }
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
