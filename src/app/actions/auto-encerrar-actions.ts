'use server';

/**
 * Lote focado: reescaneia ativos com sinal de baixa tribunal (ou todos ativos em fatia)
 * para o motor auto-encerrar gravar ENCERRADO + flag W1.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';

export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  /** só quem já tem datajud_encerrado_tribunal */
  soBaixaTribunal?: boolean;
}): Promise<{
  success: boolean;
  scanned: number;
  autoEncerrados: number;
  revisao: number;
  failed: number;
  error?: string;
  samples?: string[];
}> {
  try {
    const { empresa_id, auth_id } = await getUserContext();
    if (!empresa_id) return { success: false, scanned: 0, autoEncerrados: 0, revisao: 0, failed: 0, error: 'Sem sessão' };

    const limit = Math.min(Math.max(opts?.limit ?? 40, 5), 80);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from('processos')
      .select('id, protocolo_ref, dados, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno')
      .eq('empresa_id', empresa_id)
      .order('datajud_consultado_em', { ascending: true, nullsFirst: true })
      .limit(limit * 4);

    if (soBaixa) {
      q = q.eq('datajud_encerrado_tribunal', true);
    }

    const { data: rows, error } = await q;
    if (error) {
      return { success: false, scanned: 0, autoEncerrados: 0, revisao: 0, failed: 0, error: error.message };
    }

    const targets: { protocolo: string }[] = [];
    for (const row of rows || []) {
      const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
      const c = processarCaso({
        ...dados,
        protocolo: row.protocolo_ref || dados.protocolo,
        datajud_encerrado_tribunal: row.datajud_encerrado_tribunal,
        is_procedente: row.is_procedente,
        em_cumprimento_sentenca: row.em_cumprimento_sentenca,
        cumprimento_pendente_necessario: row.cumprimento_pendente_necessario,
        situacao: dados.situacao || row.status_interno,
        status: row.status,
        via_scan_auto_encerrar: dados.via_scan_auto_encerrar,
      });
      if (isCasoEncerrado(c)) continue;
      if (dados.via_scan_auto_encerrar) continue;
      const proto = String(row.protocolo_ref || dados.protocolo || '').trim();
      if (!proto) continue;
      targets.push({ protocolo: proto });
      if (targets.length >= limit) break;
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    const samples: string[] = [];

    for (const t of targets) {
      try {
        const res = await auditCaseCoreSystem(t.protocolo, empresa_id, 'both', { fast: true });
        const p = (res.casePatch as any) || {};
        if (p.via_scan_auto_encerrar || p.dados?.via_scan_auto_encerrar) {
          autoEncerrados++;
          if (samples.length < 8) samples.push(`${t.protocolo} · AUTO`);
        } else if (p.precisa_revisar_encerramento || p.dados?.precisa_revisar_encerramento) {
          revisao++;
          if (samples.length < 8) samples.push(`${t.protocolo} · REVISAR`);
        }
        if (!res.success) failed++;
      } catch {
        failed++;
      }
    }

    return {
      success: true,
      scanned: targets.length,
      autoEncerrados,
      revisao,
      failed,
      samples,
    };
  } catch (e: any) {
    return {
      success: false,
      scanned: 0,
      autoEncerrados: 0,
      revisao: 0,
      failed: 0,
      error: e?.message || String(e),
    };
  }
}
