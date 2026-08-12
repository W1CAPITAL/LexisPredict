'use server';

/**
 * Auditoria DEFENSIVA — só Superadmin.
 * Não executa scan ofensivo, exploit nem pentest.
 */

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { checkIfSuperAdmin } from '@/lib/supabase';

export type SecurityCheck = {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail' | 'info';
  detail: string;
};

async function assertSuperAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.email && !ctx?.auth_id) return { ok: false as const, error: 'Sessão expirada' };
  // cargo no profile
  const cargo = (ctx as any).cargo || '';
  const isSA =
    checkIfSuperAdmin?.({ cargo } as any) ||
    String(cargo).toLowerCase() === 'superadmin' ||
    String(cargo).toLowerCase() === 'super admin';
  if (!isSA) {
    // fallback: alguns deploys usam flag isSuperAdmin no context
    if (!(ctx as any).isSuperAdmin) {
      return { ok: false as const, error: 'Apenas Superadmin' };
    }
  }
  return { ok: true as const, ctx };
}

export async function runDefensiveSecurityAuditAction(): Promise<{
  success: boolean;
  error?: string;
  checks: SecurityCheck[];
  generatedAt: string;
}> {
  const gate = await assertSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error, checks: [], generatedAt: new Date().toISOString() };

  const checks: SecurityCheck[] = [];

  // 1) Env secrets presence (não revela valores)
  const envFlags: Array<[string, string]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL || ''],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY || ''],
    ['CRON_SECRET', process.env.CRON_SECRET || ''],
    ['NVIDIA_API_KEY', process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || ''],
    ['LEXIS_OCR_ENDPOINT', process.env.LEXIS_OCR_ENDPOINT || ''],
  ];

  for (const [name, val] of envFlags) {
    const present = !!val.trim();
    const critical = name.includes('SERVICE_ROLE') || name.includes('CRON');
    checks.push({
      id: `env_${name}`,
      label: `Env ${name}`,
      status: present ? 'ok' : critical ? 'warn' : 'info',
      detail: present ? 'Configurado (valor oculto)' : 'Ausente neste deploy',
    });
  }

  // 2) Service role não deve estar em NEXT_PUBLIC
  const leaked =
    !!(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY);
  checks.push({
    id: 'no_public_service_role',
    label: 'Service role fora do browser',
    status: leaked ? 'fail' : 'ok',
    detail: leaked
      ? 'Há SERVICE_ROLE em variável NEXT_PUBLIC_* — risco grave'
      : 'Nenhuma SERVICE_ROLE pública detectada no process.env',
  });

  // 3) Supabase admin reachability
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin.from('usuarios').select('id').limit(1);
    checks.push({
      id: 'supabase_admin',
      label: 'Conexão admin Supabase',
      status: error ? 'warn' : 'ok',
      detail: error ? error.message.slice(0, 160) : 'Consulta usuarios ok',
    });
  } catch (e: any) {
    checks.push({
      id: 'supabase_admin',
      label: 'Conexão admin Supabase',
      status: 'fail',
      detail: e?.message || 'Falha getSupabaseAdmin',
    });
  }

  // 4) Multi-tenant: amostra se processos têm empresa_id
  try {
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin.from('processos').select('id, empresa_id').limit(5);
    if (error) {
      checks.push({
        id: 'tenant_processos',
        label: 'Amostra processos.empresa_id',
        status: 'warn',
        detail: error.message.slice(0, 160),
      });
    } else {
      const missing = (data || []).filter((r: any) => !r.empresa_id).length;
      checks.push({
        id: 'tenant_processos',
        label: 'Amostra processos.empresa_id',
        status: missing ? 'fail' : 'ok',
        detail: missing
          ? `${missing} linha(s) sem empresa_id na amostra`
          : `Amostra ${(data || []).length} com empresa_id`,
      });
    }
  } catch (e: any) {
    checks.push({
      id: 'tenant_processos',
      label: 'Amostra processos.empresa_id',
      status: 'info',
      detail: e?.message || 'Não verificado',
    });
  }

  // 5) Cookies de sessão (contexto)
  const ctx = gate.ctx!;
  checks.push({
    id: 'session_context',
    label: 'Contexto de sessão server',
    status: ctx.empresa_id ? 'ok' : 'warn',
    detail: ctx.empresa_id
      ? `empresa_id presente · cargo=${(ctx as any).cargo || '?'}`
      : 'empresa_id ausente no getUserContext',
  });

  // 6) Lembrete defensivo (não ofensivo)
  checks.push({
    id: 'policy',
    label: 'Política da aba',
    status: 'info',
    detail:
      'Somente checagens defensivas. Pentest/exploit (ex.: Strix) deve rodar fora do Lexis, só no seu domínio e com autorização.',
  });

  return {
    success: true,
    checks,
    generatedAt: new Date().toISOString(),
  };
}
