'use server';

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';

export type HonorarioRow = {
  id: string;
  empresa_id: string;
  created_by?: string | null;
  protocolo?: string | null;
  cliente?: string | null;
  tipo: string;
  descricao?: string | null;
  valor: number;
  status: string;
  vencimento?: string | null;
  pago_em?: string | null;
  observacao?: string | null;
  created_at?: string;
};

export async function listHonorariosAction(opts?: {
  status?: string;
  protocolo?: string;
  limit?: number;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão expirada', rows: [] as HonorarioRow[] };
  try {
    const admin = await getSupabaseAdmin();
    let q = admin
      .from('honorarios')
      .select('*')
      .eq('empresa_id', ctx.empresa_id)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 200);
    if (opts?.status && opts.status !== 'todos') q = q.eq('status', opts.status);
    if (opts?.protocolo) q = q.eq('protocolo', opts.protocolo);
    const { data, error } = await q;
    if (error) {
      return {
        success: false as const,
        error:
          error.message.includes('honorarios')
            ? 'Tabela honorarios ausente. Rode supabase/honorarios.sql no SQL Editor.'
            : error.message,
        rows: [] as HonorarioRow[],
      };
    }
    return { success: true as const, rows: (data || []) as HonorarioRow[] };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha', rows: [] as HonorarioRow[] };
  }
}

export async function upsertHonorarioAction(input: {
  id?: string;
  protocolo?: string;
  cliente?: string;
  tipo: string;
  descricao?: string;
  valor: number;
  status: string;
  vencimento?: string;
  pago_em?: string;
  observacao?: string;
}) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão expirada' };
  try {
    const admin = await getSupabaseAdmin();
    const row: Record<string, any> = {
      empresa_id: ctx.empresa_id,
      created_by: ctx.auth_id || null,
      protocolo: input.protocolo || null,
      cliente: input.cliente || null,
      tipo: input.tipo || 'honorario',
      descricao: input.descricao || null,
      valor: Number(input.valor) || 0,
      status: input.status || 'pendente',
      vencimento: input.vencimento || null,
      pago_em: input.pago_em || null,
      observacao: input.observacao || null,
      updated_at: new Date().toISOString(),
    };
    if (input.id) {
      const { error } = await admin.from('honorarios').update(row).eq('id', input.id).eq('empresa_id', ctx.empresa_id);
      if (error) return { success: false as const, error: error.message };
      return { success: true as const, id: input.id };
    }
    const { data, error } = await admin.from('honorarios').insert(row).select('id').maybeSingle();
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, id: data?.id };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha ao salvar' };
  }
}

export async function deleteHonorarioAction(id: string) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false as const, error: 'Sessão' };
  const admin = await getSupabaseAdmin();
  const { error } = await admin.from('honorarios').delete().eq('id', id).eq('empresa_id', ctx.empresa_id);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function resumoFinanceiroAction() {
  const list = await listHonorariosAction({ limit: 500 });
  if (!list.success) return { success: false as const, error: list.error, resumo: null };
  const rows = list.rows;
  let pendente = 0;
  let pago = 0;
  let vencido = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const r of rows) {
    const v = Number(r.valor) || 0;
    if (r.status === 'pago') pago += v;
    else if (r.status === 'cancelado') continue;
    else {
      pendente += v;
      if (r.vencimento && r.vencimento < today) vencido += v;
    }
  }
  return {
    success: true as const,
    resumo: {
      total: rows.length,
      pendente,
      pago,
      vencido,
      a_receber: pendente,
    },
  };
}
