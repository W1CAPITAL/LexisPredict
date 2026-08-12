'use server';

/**
 * CRM Pipeline v2 — atividades, tarefas, move stage, contatos observados.
 * Inspirado em Twenty (Opportunity/Timeline/Task) + Comp AI (só fatos observados).
 * Não substitui crm-actions.ts — complementa.
 */

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import type { CrmActivity, CrmTask, CrmNegocio } from '@/lib/crm-types';
import { CRM_FUNIL_STATUS } from '@/lib/crm-types';

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `crm_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function ctxOrFail() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return null;
  return ctx;
}

function tableMissing(msg: string) {
  return (
    /crm_|schema cache|does not exist|relation|column/i.test(msg || '')
  );
}

/** Move negócio de estágio (kanban) + log de atividade */
export async function moveNegocioStageAction(id: string, status: string, position?: number) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão expirada' };
  if (!CRM_FUNIL_STATUS.includes(status as any)) {
    return { success: false as const, error: 'Status inválido' };
  }
  try {
    const admin = await getSupabaseAdmin();
    const { data: prev } = await admin
      .from('crm_negocios')
      .select('id, status, cliente_nome')
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id)
      .maybeSingle();
    if (!prev) return { success: false as const, error: 'Negócio não encontrado' };

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    if (typeof position === 'number') patch.position = position;
    if (status === 'concluido' || status === 'cancelado') {
      patch.data_fechamento = new Date().toISOString().slice(0, 10);
    }

    const { error } = await admin
      .from('crm_negocios')
      .update(patch)
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    if (error) return { success: false as const, error: error.message };

    // timeline (ignore if table missing)
    try {
      await admin.from('crm_atividades').insert({
        id: uid(),
        empresa_id: ctx.empresa_id,
        negocio_id: id,
        tipo: 'status_change',
        titulo: `Status: ${prev.status} → ${status}`,
        corpo: prev.cliente_nome || null,
        created_by: ctx.auth_id,
        meta: { from: prev.status, to: status },
        created_at: new Date().toISOString(),
      });
    } catch { /* optional table */ }

    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha ao mover' };
  }
}

export async function listAtividadesAction(negocioId: string, limit = 40) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão', rows: [] as CrmActivity[] };
  try {
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from('crm_atividades')
      .select('*')
      .eq('empresa_id', ctx.empresa_id)
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      if (tableMissing(error.message)) return { success: true as const, rows: [] as CrmActivity[], needMigration: true };
      return { success: false as const, error: error.message, rows: [] as CrmActivity[] };
    }
    return { success: true as const, rows: (data || []) as CrmActivity[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message, rows: [] as CrmActivity[] };
  }
}

export async function addAtividadeAction(input: {
  negocio_id: string;
  tipo?: string;
  titulo: string;
  corpo?: string;
}) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão' };
  if (!input.negocio_id || !input.titulo?.trim()) return { success: false as const, error: 'Dados incompletos' };
  try {
    const admin = await getSupabaseAdmin();
    const row = {
      id: uid(),
      empresa_id: ctx.empresa_id,
      negocio_id: input.negocio_id,
      tipo: input.tipo || 'nota',
      titulo: input.titulo.trim(),
      corpo: input.corpo?.trim() || null,
      created_by: ctx.auth_id,
      created_at: new Date().toISOString(),
    };
    const { error } = await admin.from('crm_atividades').insert(row);
    if (error) return { success: false as const, error: error.message };
    await admin
      .from('crm_negocios')
      .update({ last_activity_at: row.created_at, updated_at: row.created_at })
      .eq('id', input.negocio_id)
      .eq('empresa_id', ctx.empresa_id);
    return { success: true as const, row: row as CrmActivity };
  } catch (e: any) {
    return { success: false as const, error: e?.message };
  }
}

export async function listTarefasAction(opts?: { negocio_id?: string; openOnly?: boolean }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, rows: [] as CrmTask[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin.from('crm_tarefas').select('*').eq('empresa_id', ctx.empresa_id).order('due_at', { ascending: true, nullsFirst: false }).limit(100);
    if (opts?.negocio_id) q = q.eq('negocio_id', opts.negocio_id);
    if (opts?.openOnly) q = q.eq('feito', false);
    const { data, error } = await q;
    if (error) {
      if (tableMissing(error.message)) return { success: true as const, rows: [] as CrmTask[], needMigration: true };
      return { success: false as const, rows: [] as CrmTask[], error: error.message };
    }
    return { success: true as const, rows: (data || []) as CrmTask[] };
  } catch (e: any) {
    return { success: false as const, rows: [] as CrmTask[], error: e?.message };
  }
}

export async function upsertTarefaAction(input: Partial<CrmTask> & { titulo: string }) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, error: 'Sessão' };
  try {
    const admin = await getSupabaseAdmin();
    const id = input.id || uid();
    const row = {
      id,
      empresa_id: ctx.empresa_id,
      negocio_id: input.negocio_id || null,
      titulo: input.titulo.trim(),
      feito: !!input.feito,
      due_at: input.due_at || null,
      assignee_id: input.assignee_id || ctx.auth_id,
      created_by: input.created_by || ctx.auth_id,
      created_at: input.created_at || new Date().toISOString(),
    };
    const { error } = await admin.from('crm_tarefas').upsert(row, { onConflict: 'id' });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, row: row as CrmTask };
  } catch (e: any) {
    return { success: false as const, error: e?.message };
  }
}

export async function toggleTarefaAction(id: string, feito: boolean) {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const };
  try {
    const admin = await getSupabaseAdmin();
    const { error } = await admin
      .from('crm_tarefas')
      .update({ feito })
      .eq('id', id)
      .eq('empresa_id', ctx.empresa_id);
    return { success: !error, error: error?.message };
  } catch (e: any) {
    return { success: false as const, error: e?.message };
  }
}

/**
 * Contatos observados a partir de negócios (não inventa telefone/email).
 * Opcionalmente cruza nomes com processos da empresa.
 */
export async function listContatosObservadosAction() {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, rows: [] as any[] };
  try {
    const admin = await getSupabaseAdmin();
    const { data: negocios, error } = await admin
      .from('crm_negocios')
      .select('id, cliente_nome, cliente_doc, cliente_telefone, cliente_email, created_at')
      .eq('empresa_id', ctx.empresa_id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return { success: false as const, rows: [], error: error.message };

    const byKey = new Map<string, any>();
    for (const n of negocios || []) {
      const key = (n.cliente_doc || n.cliente_nome || '').toString().trim().toUpperCase();
      if (!key) continue;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, {
          id: key,
          empresa_id: ctx.empresa_id,
          nome: n.cliente_nome,
          doc: n.cliente_doc || null,
          telefone: n.cliente_telefone || null,
          email: n.cliente_email || null,
          origem: 'crm_negocios',
          negocio_ids: [n.id],
        });
      } else {
        prev.negocio_ids.push(n.id);
        if (!prev.telefone && n.cliente_telefone) prev.telefone = n.cliente_telefone;
        if (!prev.email && n.cliente_email) prev.email = n.cliente_email;
      }
    }
    return { success: true as const, rows: Array.from(byKey.values()) };
  } catch (e: any) {
    return { success: false as const, rows: [], error: e?.message };
  }
}

/** Sugestões só com base em contagens observadas (sem inventar fatos de cliente) */
export async function crmObservedHintsAction() {
  const ctx = await ctxOrFail();
  if (!ctx) return { success: false as const, hints: [] as string[] };
  try {
    const admin = await getSupabaseAdmin();
    const { data: negocios } = await admin
      .from('crm_negocios')
      .select('status')
      .eq('empresa_id', ctx.empresa_id)
      .limit(1000);
    const { count: atrasados } = await admin
      .from('crm_receber')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', ctx.empresa_id)
      .eq('status', 'atrasado');
    const list = (negocios || []) as CrmNegocio[];
    const { observedPipelineHints } = await import('@/lib/crm-pipeline');
    const hints = observedPipelineHints(list, atrasados || 0);
    return { success: true as const, hints };
  } catch (e: any) {
    return { success: false as const, hints: [], error: e?.message };
  }
}
