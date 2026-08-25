'use server';

/**
 * Auto-encerrar em páginas — o cliente repete até esgotar a empresa.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';

const PAGE = 35;

export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  soBaixaTribunal?: boolean;
}): Promise<{
  success: boolean;
  scanned: number;
  autoEncerrados: number;
  revisao: number;
  failed: number;
  offset: number;
  nextOffset: number;
  totalCandidates: number;
  hasMore: boolean;
  error?: string;
  samples?: string[];
}> {
  const empty = {
    success: false,
    scanned: 0,
    autoEncerrados: 0,
    revisao: 0,
    failed: 0,
    offset: 0,
    nextOffset: 0,
    totalCandidates: 0,
    hasMore: false,
  };
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: 'Sem sessão' };

    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 5), 50);
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from('processos')
      .select(
        'id, protocolo_ref, dados, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno',
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .order('id', { ascending: true })
      .range(offset, offset + limit * 8 - 1);

    if (soBaixa) {
      q = q.eq('datajud_encerrado_tribunal', true);
    }

    const { data: rows, error, count } = await q;
    if (error) {
      return { ...empty, offset, nextOffset: offset, error: error.message };
    }

    const targets: string[] = [];
    for (const row of rows || []) {
      const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
      if (dados.via_scan_auto_encerrar) continue;
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
      const proto = String(row.protocolo_ref || dados.protocolo || '').trim();
      if (!proto) continue;
      targets.push(proto);
      if (targets.length >= limit) break;
    }

    let totalCandidates = typeof count === 'number' ? count : offset + targets.length;

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    const samples: string[] = [];

    for (const protocolo of targets) {
      try {
        const res = await auditCaseCoreSystem(protocolo, empresa_id, 'both', { fast: true });
        const p = (res.casePatch as any) || {};
        if (p.via_scan_auto_encerrar || p.dados?.via_scan_auto_encerrar) {
          autoEncerrados++;
          if (samples.length < 6) samples.push(`${protocolo} · AUTO`);
        } else if (p.precisa_revisar_encerramento || p.dados?.precisa_revisar_encerramento) {
          revisao++;
          if (samples.length < 6) samples.push(`${protocolo} · REVISAR`);
        }
        if (!res.success) failed++;
      } catch {
        failed++;
      }
    }

    const rowsRead = (rows || []).length;
    const nextOffset = offset + Math.max(rowsRead, limit);

    return {
      success: true,
      scanned: targets.length,
      autoEncerrados,
      revisao,
      failed,
      offset,
      nextOffset,
      totalCandidates,
      hasMore: rowsRead >= limit * 2 || (rowsRead > 0 && targets.length >= limit),
      samples,
    };
  } catch (e: any) {
    return {
      ...empty,
      offset: opts?.offset ?? 0,
      nextOffset: opts?.offset ?? 0,
      error: e?.message || String(e),
    };
  }
}

export async function countAutoEncerrarPendentesAction(): Promise<{
  success: boolean;
  baixaAtivos: number;
  error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false, baixaAtivos: 0, error: 'Sem sessão' };
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from('processos')
      .select('id, dados, status, status_interno, datajud_encerrado_tribunal')
      .eq('empresa_id', empresa_id)
      .eq('datajud_encerrado_tribunal', true)
      .limit(5000);
    if (error) return { success: false, baixaAtivos: 0, error: error.message };
    let n = 0;
    for (const row of data || []) {
      const d = row.dados && typeof row.dados === 'object' ? row.dados : {};
      if (d.via_scan_auto_encerrar) continue;
      const sit = String(d.situacao || row.status_interno || '').toUpperCase();
      if (/ENCERRAD|ARQUIVAD|EXTINT|FINALIZ/.test(sit)) continue;
      const st = String(row.status || d.status || '').toUpperCase();
      if (/ARQUIVAD|ENCERRAD/.test(st)) continue;
      n++;
    }
    return { success: true, baixaAtivos: n };
  } catch (e: any) {
    return { success: false, baixaAtivos: 0, error: e?.message || String(e) };
  }
}
