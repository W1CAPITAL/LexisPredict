'use server';

/**
 * Fila de follow-up automática — só sinais do banco (sem inventar).
 * - Negócios em lead/proposta sem updated_at recente
 * - Títulos crm_receber atrasados
 */

import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';

export type FollowUpItem = {
  kind: 'negocio_parado' | 'receber_atrasado';
  id: string;
  title: string;
  detail: string;
  href: string;
  signalAt?: string | null;
};

export async function listObservedFollowUpsAction(daysStuck = 7): Promise<{
  success: boolean;
  items: FollowUpItem[];
  error?: string;
}> {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { success: false, items: [], error: 'Sessão' };

  const items: FollowUpItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysStuck);
  const cutoffIso = cutoff.toISOString();

  try {
    const admin = await getSupabaseAdmin();

    const { data: negocios } = await admin
      .from('crm_negocios')
      .select('id, cliente_nome, status, updated_at, created_at')
      .eq('empresa_id', ctx.empresa_id)
      .in('status', ['lead', 'proposta'])
      .limit(200);

    for (const n of negocios || []) {
      const ts = n.updated_at || n.created_at;
      if (ts && ts < cutoffIso) {
        items.push({
          kind: 'negocio_parado',
          id: n.id,
          title: n.cliente_nome || 'Negócio',
          detail: `Status ${n.status} sem movimento há ≥${daysStuck} dias (dado do banco).`,
          href: '/crm/funil',
          signalAt: ts,
        });
      }
    }

    const { data: atrasados } = await admin
      .from('crm_receber')
      .select('id, cliente_nome, valor, vencimento, status')
      .eq('empresa_id', ctx.empresa_id)
      .eq('status', 'atrasado')
      .limit(100);

    for (const r of atrasados || []) {
      items.push({
        kind: 'receber_atrasado',
        id: r.id,
        title: r.cliente_nome || 'Título',
        detail: `Receber atrasado · R$ ${Number(r.valor || 0).toLocaleString('pt-BR')} · venc. ${r.vencimento || '?'}`,
        href: '/crm/cobranca',
        signalAt: r.vencimento,
      });
    }

    return { success: true, items };
  } catch (e: any) {
    return { success: false, items: [], error: e?.message };
  }
}
