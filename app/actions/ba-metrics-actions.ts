'use server';

/**
 * Contagem de B.A. com base nos hits da aba Busca e Apreensão (ba_scan_logs).
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';

function digits(p: string | null | undefined) {
  return String(p || '')
    .replace(/\D/g, '')
    .slice(0, 20);
}

export async function fetchBaHitProtocolosAction(): Promise<{
  success: boolean;
  protocolDigits: string[];
  totalHits: number;
  error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, protocolDigits: [], totalHits: 0, error: '401' };
    }

    const admin = await getSupabaseAdmin();
    if (!admin) {
      return { success: false, protocolDigits: [], totalHits: 0, error: 'no-admin' };
    }

    const { data, error } = await admin
      .from('ba_scan_logs')
      .select('protocolo_ref, processo_djen, motivo_ba, payload')
      .eq('empresa_id', empresa_id)
      .neq('motivo_ba', 'CONSULTA_SEM_BA')
      .limit(5000);

    if (error) {
      return {
        success: false,
        protocolDigits: [],
        totalHits: 0,
        error: error.message,
      };
    }

    const set = new Set<string>();
    for (const row of data || []) {
      const a = digits(row.protocolo_ref);
      const b = digits(row.processo_djen);
      if (a.length >= 15) set.add(a);
      if (b.length >= 15) set.add(b);
      const payload = row.payload as any;
      if (payload?.protocoloCarteira) {
        const d = digits(payload.protocoloCarteira);
        if (d.length >= 15) set.add(d);
      }
      if (Array.isArray(payload?.protocolosCarteira)) {
        for (const p of payload.protocolosCarteira) {
          const d = digits(p);
          if (d.length >= 15) set.add(d);
        }
      }
    }

    return {
      success: true,
      protocolDigits: [...set],
      totalHits: (data || []).length,
    };
  } catch (e: any) {
    return {
      success: false,
      protocolDigits: [],
      totalHits: 0,
      error: e?.message || 'fail',
    };
  }
}
