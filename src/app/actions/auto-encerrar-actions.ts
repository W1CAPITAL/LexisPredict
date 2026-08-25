'use server';

/**
 * Scanner de encerramento ROBUSTO (multi-motor):
 * 1) Banco (flags + movimentos/resumo já salvos)
 * 2) DataJud + DJEN via scanSingleCaseAction (mesmo núcleo do Scanner Tribunal)
 * 3) decidirEncerramentoScan / aplicarDecisaoNoPatch (auto vs revisar)
 *
 * Lotes generosos; o cliente repete até esgotar a empresa.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { scanSingleCaseAction } from '@/app/actions/case-actions';
import {
  decidirEncerramentoScan,
  aplicarDecisaoNoPatch,
} from '@/lib/auto-encerrar-scan';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';
import { updateCaseDataJudSystem } from '@/lib/server-db';

/** Por chamada server (Vercel ~60s). Cliente empilha dezenas de lotes. */
const PAGE_TRIBUNAL = 25;
const PAGE_DB = 80;

function truthy(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'sim' || s === 'yes';
}

function rowToTarget(row: any) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  return {
    ...dados,
    id: row.id,
    protocolo: row.protocolo_ref || dados.protocolo,
    datajud_encerrado_tribunal: row.datajud_encerrado_tribunal ?? dados.datajud_encerrado_tribunal,
    is_procedente: row.is_procedente ?? dados.is_procedente,
    em_cumprimento_sentenca: row.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
    cumprimento_pendente_necessario:
      row.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
    situacao: dados.situacao || row.status_interno,
    status: row.status,
    via_scan_auto_encerrar: dados.via_scan_auto_encerrar,
    procedente_motivo: row.procedente_motivo || dados.procedente_motivo,
    datajud_encerrado_motivo: row.datajud_encerrado_motivo || dados.datajud_encerrado_motivo,
    djen_ultimo_resumo: row.djen_ultimo_resumo || dados.djen_ultimo_resumo,
    evento_resumo: dados.evento_resumo,
    indicio_busca_apreensao: row.indicio_busca_apreensao ?? dados.indicio_busca_apreensao,
    dados,
  };
}

function isAtivoRow(row: any): boolean {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  if (truthy(dados.via_scan_auto_encerrar)) return false;
  try {
    const c = processarCaso(rowToTarget(row));
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
  baixaAtivos: number;
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
      totalPendentes: baixaAtivos,
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
 * Lote robusto.
 * fase 'db'  → decide só com o que já está salvo (rápido)
 * fase 'tribunal' → DataJud + DJEN + motores (completo)
 */
export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  soBaixaTribunal?: boolean;
  /** 'db' | 'tribunal' | 'full' (db primeiro no mesmo item, senão tribunal) */
  fase?: 'db' | 'tribunal' | 'full';
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
    fonte: 'full',
  };
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: 'Sem sessão' };

    const fase = opts?.fase || 'full';
    const limit = Math.min(
      Math.max(opts?.limit ?? (fase === 'db' ? PAGE_DB : PAGE_TRIBUNAL), 5),
      fase === 'db' ? 120 : 30
    );
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const fast = opts?.fast !== false;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from('processos')
      .select(
        'id, protocolo_ref, dados, datajud_encerrado_tribunal, datajud_encerrado_motivo, is_procedente, procedente_motivo, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno, djen_ultimo_resumo, indicio_busca_apreensao',
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .order('id', { ascending: true })
      .range(offset, offset + limit * 6 - 1);

    if (soBaixa) q = q.eq('datajud_encerrado_tribunal', true);

    const { data: rows, error, count } = await q;
    if (error) {
      return { ...empty, offset, nextOffset: offset, error: error.message };
    }

    const totalCandidates = typeof count === 'number' ? count : offset + (rows?.length || 0);

    const targets: any[] = [];
    for (const row of rows || []) {
      if (!isAtivoRow(row)) continue;
      const proto = String(row.protocolo_ref || '').trim();
      if (!proto) continue;
      targets.push(row);
      if (targets.length >= limit) break;
    }

    let autoEncerrados = 0;
    let revisao = 0;
    let failed = 0;
    let scanned = 0;
    let lastError = '';
    const samples: string[] = [];

    for (const row of targets) {
      scanned++;
      const proto = String(row.protocolo_ref || '').trim();
      const target = rowToTarget(row);

      try {
        // --- Motor 1: decisão com o que já está no banco ---
        if (fase === 'db' || fase === 'full') {
          const decisaoDb = decidirEncerramentoScan({
            target,
            patch: {
              datajud_encerrado_tribunal: target.datajud_encerrado_tribunal,
              datajud_encerrado_motivo: target.datajud_encerrado_motivo,
              is_procedente: target.is_procedente,
              em_cumprimento_sentenca: target.em_cumprimento_sentenca,
              cumprimento_pendente_necessario: target.cumprimento_pendente_necessario,
              indicio_busca_apreensao: target.indicio_busca_apreensao,
              evento_resumo: target.evento_resumo,
              djen_ultimo_resumo: target.djen_ultimo_resumo,
            },
          });

          if (decisaoDb.acao === 'auto_encerrar' || decisaoDb.acao === 'revisao_fila') {
            const patch = aplicarDecisaoNoPatch({}, target, decisaoDb);
            const saved = await updateCaseDataJudSystem(row.id, patch);
            if (saved.success) {
              if (decisaoDb.acao === 'auto_encerrar') {
                autoEncerrados++;
                if (samples.length < 15) samples.push(`${proto} · AUTO/DB`);
              } else {
                revisao++;
                if (samples.length < 15) samples.push(`${proto} · REVISAR/DB`);
              }
              continue; // não precisa tribunal neste item
            }
            lastError = saved.error || 'persist db fail';
          }
        }

        // --- Motor 2: DataJud + DJEN (tribunal completo) ---
        if (fase === 'tribunal' || fase === 'full') {
          const res = await scanSingleCaseAction(proto, {
            mode: 'both',
            fast,
          });
          const p = ((res as any).casePatch || {}) as any;
          const dados = p.dados && typeof p.dados === 'object' ? p.dados : {};

          if (p.via_scan_auto_encerrar || dados.via_scan_auto_encerrar) {
            autoEncerrados++;
            if (samples.length < 15) samples.push(`${proto} · AUTO/TRIB`);
          } else if (p.precisa_revisar_encerramento || dados.precisa_revisar_encerramento) {
            revisao++;
            if (samples.length < 15) samples.push(`${proto} · REVISAR/TRIB`);
          } else if (!(res as any).success) {
            failed++;
            lastError = String((res as any).error || 'scan fail');
          } else if (samples.length < 10) {
            samples.push(`${proto} · ok`);
          }
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
      fonte: fase === 'db' ? 'supabase' : fase === 'tribunal' ? 'datajud+djen' : 'db+datajud+djen',
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
