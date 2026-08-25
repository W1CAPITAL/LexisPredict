'use server';

/**
 * Scanner de encerramento ROBUSTO — mesmo núcleo do Scanner Tribunal
 * (auditCaseCoreSystem / scanSingleCaseAction · DataJud + DJEN).
 * Depois do scan aplica decidirEncerramentoScan (AUTO ou revisar).
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { scanSingleCaseAction } from '@/app/actions/case-actions';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';

const PAGE = 12; // por lote: DataJud+DJEN é lento; cliente repete

function isAtivoRow(row: any): boolean {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  if (dados.via_scan_auto_encerrar) return false;
  try {
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
    if (isCasoEncerrado(c)) return false;
  } catch {
    /* */
  }
  const sit = String(dados.situacao || row.status_interno || '').toUpperCase();
  if (/ENCERRAD|ARQUIVAD|EXTINT|FINALIZ/.test(sit)) return false;
  const st = String(row.status || '').toUpperCase();
  if (/^ARQUIVAD|^ENCERRAD/.test(st)) return false;
  return true;
}

export async function countAutoEncerrarPendentesAction(): Promise<{
  success: boolean;
  /** Ativos com baixa tribunal — fila prioritária do scanner de encerrar */
  baixaAtivos: number;
  /** Outros ativos (sem baixa flag) — opcional no modo empresa toda */
  outrosAtivos: number;
  totalPendentes: number;
  baixasTribunalTotal: number;
  error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id)
      return {
        success: false,
        baixaAtivos: 0,
        outrosAtivos: 0,
        totalPendentes: 0,
        baixasTribunalTotal: 0,
        error: 'Sem sessão',
      };
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from('processos')
      .select(
        'id, dados, status, status_interno, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, protocolo_ref'
      )
      .eq('empresa_id', empresa_id)
      .limit(8000);
    if (error)
      return {
        success: false,
        baixaAtivos: 0,
        outrosAtivos: 0,
        totalPendentes: 0,
        baixasTribunalTotal: 0,
        error: error.message,
      };

    let baixaAtivos = 0;
    let outrosAtivos = 0;
    let baixasTribunalTotal = 0;
    for (const row of data || []) {
      if (row.datajud_encerrado_tribunal) baixasTribunalTotal++;
      if (!isAtivoRow(row)) continue;
      if (row.datajud_encerrado_tribunal) baixaAtivos++;
      else outrosAtivos++;
    }
    return {
      success: true,
      baixaAtivos,
      outrosAtivos,
      totalPendentes: baixaAtivos, // modo padrão: só baixas ativas
      baixasTribunalTotal,
    };
  } catch (e: any) {
    return {
      success: false,
      baixaAtivos: 0,
      outrosAtivos: 0,
      totalPendentes: 0,
      baixasTribunalTotal: 0,
      error: e?.message || String(e),
    };
  }
}

/**
 * Um lote do scanner de encerramento (DataJud + DJEN).
 * soBaixaTribunal=true: só quem já tem flag de baixa e ainda está ativo.
 */
export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  soBaixaTribunal?: boolean;
  /** fast=false = scan mais completo (mais lento) */
  fast?: boolean;
}): Promise<{
  success: boolean;
  scanned: number;
  autoEncerrados: number;
  revisao: number;
  skipped: number;
  failed: number;
  offset: number;
  nextOffset: number;
  totalCandidates: number;
  hasMore: boolean;
  percentDone: number;
  percentLeft: number;
  fonte: string;
  error?: string;
  samples?: string[];
  lastError?: string;
}> {
  const empty = {
    success: false,
    scanned: 0,
    autoEncerrados: 0,
    revisao: 0,
    skipped: 0,
    failed: 0,
    offset: 0,
    nextOffset: 0,
    totalCandidates: 0,
    hasMore: false,
    percentDone: 0,
    percentLeft: 100,
    fonte: 'datajud+djen',
  };
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: 'Sem sessão' };

    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 3), 20);
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const fast = opts?.fast !== false; // default fast para não estourar timeout
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

    if (soBaixa) q = q.eq('datajud_encerrado_tribunal', true);

    const { data: rows, error, count } = await q;
    if (error) {
      return { ...empty, offset, nextOffset: offset, error: error.message };
    }

    const totalCandidates = typeof count === 'number' ? count : offset + (rows?.length || 0);

    const targets: { id: string; protocolo: string }[] = [];
    for (const row of rows || []) {
      if (!isAtivoRow(row)) continue;
      const proto = String(row.protocolo_ref || '').trim();
      if (!proto) continue;
      targets.push({ id: row.id, protocolo: proto });
      if (targets.length >= limit) break;
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    let lastError = '';
    const samples: string[] = [];

    for (const t of targets) {
      scanned++;
      try {
        // Núcleo idêntico ao Scanner Tribunal (DataJud + DJEN)
        const res = await scanSingleCaseAction(t.protocolo, {
          mode: 'both',
          fast,
        });
        const p = ((res as any).casePatch || (res as any).case || {}) as any;
        const dados = p.dados && typeof p.dados === 'object' ? p.dados : {};

        if (p.via_scan_auto_encerrar || dados.via_scan_auto_encerrar) {
          autoEncerrados++;
          if (samples.length < 12) samples.push(`${t.protocolo} · AUTO`);
        } else if (p.precisa_revisar_encerramento || dados.precisa_revisar_encerramento) {
          revisao++;
          if (samples.length < 12) samples.push(`${t.protocolo} · REVISAR`);
        } else if (!(res as any).success) {
          failed++;
          lastError = String((res as any).error || 'scan fail');
        } else {
          // scanou mas decisão nenhuma (sem baixa nova) — conta como processado
          if (samples.length < 8) samples.push(`${t.protocolo} · ok/sem baixa nova`);
        }
      } catch (e: any) {
        failed++;
        lastError = e?.message || String(e);
      }
    }

    const rowsRead = (rows || []).length;
    const nextOffset = offset + Math.max(rowsRead, 1);
    const hasMore = nextOffset < totalCandidates && rowsRead > 0;
    const denom = Math.max(totalCandidates, 1);
    const percentDone = Math.min(100, Math.round((nextOffset / denom) * 100));

    return {
      success: true,
      scanned,
      autoEncerrados,
      revisao,
      skipped: Math.max(0, rowsRead - targets.length),
      failed,
      offset,
      nextOffset,
      totalCandidates,
      hasMore,
      percentDone,
      percentLeft: Math.max(0, 100 - percentDone),
      fonte: 'datajud+djen',
      samples,
      lastError: lastError || undefined,
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
