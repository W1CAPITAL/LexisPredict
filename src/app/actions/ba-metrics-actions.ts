'use server';

import { getUserContext, getSupabaseAdmin, getStoredCasesForEmpresa } from '@/lib/server-db';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { isClasseBuscaApreensao } from '@/lib/ba-evidence';

const digits = (value: unknown) => String(value || '').replace(/\D/g, '');

export async function fetchBaHitProtocolosAction(): Promise<{
  success: boolean; protocolDigits: string[]; totalHits: number; error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) throw new Error('Sessão não encontrada.');
    const admin = await getSupabaseAdmin();
    if (!admin) throw new Error('Conexão de leitura indisponível.');
    const cases = await getStoredCasesForEmpresa(empresa_id, true);
    const active = new Set(cases.filter(c => !isCasoEncerrado(c)).map(c => digits(c.protocolo)));
    const found = new Set<string>();
    // Only records verified by the current scanner can affect portfolio risk.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('ba_scan_logs')
        .select('id, protocolo_ref, processo_djen, payload')
        .eq('empresa_id', empresa_id).order('id').range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || []) {
        const payload = row.payload as any;
        const official = digits(row.processo_djen);
        const portfolio = digits(row.protocolo_ref);
        if (official.length !== 20 || official !== portfolio || !active.has(official)) continue;
        if (payload?.evidenceVerified !== true || payload?.alertarOperacional !== true) continue;
        if (!isClasseBuscaApreensao(payload.classe)) continue;
        found.add(official);
      }
      if (!data || data.length < 1000) break;
    }
    return { success: true, protocolDigits: [...found], totalHits: found.size };
  } catch (error: any) {
    return { success: false, protocolDigits: [], totalHits: 0, error: error?.message || 'Falha na leitura de B.A.' };
  }
}
