'use server';

/**
 * Auto-encerrar em lotes — PRIORIDADE: dados já no Supabase.
 * NÃO chama DataJud (lento). DJEN só sob demanda e se faltar sinal de baixa.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from '@/lib/auto-encerrar-scan';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';
import { fetchDjenComunicacoes, classifyEventFromText } from '@/lib/djen';

const PAGE = 50;

function isJaEncerradoRow(row: any, dados: any): boolean {
  if (dados?.via_scan_auto_encerrar) return true;
  const sit = String(dados?.situacao || row.status_interno || '').toUpperCase();
  if (/ENCERRAD|ARQUIVAD|EXTINT|FINALIZ/.test(sit)) return true;
  const st = String(row.status || dados?.status || '').toUpperCase();
  if (/ARQUIVAD|ENCERRAD/.test(st)) return true;
  try {
    const c = processarCaso({
      ...dados,
      protocolo: row.protocolo_ref || dados?.protocolo,
      datajud_encerrado_tribunal: row.datajud_encerrado_tribunal,
      is_procedente: row.is_procedente,
      em_cumprimento_sentenca: row.em_cumprimento_sentenca,
      cumprimento_pendente_necessario: row.cumprimento_pendente_necessario,
      situacao: dados?.situacao || row.status_interno,
      status: row.status,
      via_scan_auto_encerrar: dados?.via_scan_auto_encerrar,
    });
    if (isCasoEncerrado(c)) return true;
  } catch {
    /* */
  }
  return false;
}

function temResidualForte(row: any, dados: any): boolean {
  if (row.is_procedente || dados?.is_procedente) return true;
  if (row.em_cumprimento_sentenca || dados?.em_cumprimento_sentenca) return true;
  if (row.cumprimento_pendente_necessario || dados?.cumprimento_pendente_necessario) return true;
  if (dados?.indicio_busca_apreensao || row.indicio_busca_apreensao) return true;
  if (dados?.oportunidade_elegivel) return true;
  const text = [
    dados?.procedente_motivo,
    dados?.merito_resultado,
    dados?.evento_resumo,
    row.procedente_motivo,
  ]
    .map((x) => String(x || '').toUpperCase())
    .join(' ');
  if (/PROCEDENTE/.test(text) && !/IMPROCEDENTE/.test(text)) return true;
  if (/PARCIALMENTE\s+PROCEDENTE|CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|BUSCA\s+E\s+APREEN/.test(text))
    return true;
  return false;
}

/** DJEN: sinal de baixa/extinção/trânsito no texto já publicado (rápido vs DataJud). */
function djenSugereEncerrado(items: any[]): { ok: boolean; motivo: string } {
  if (!items?.length) return { ok: false, motivo: '' };
  const blob = items
    .slice(0, 8)
    .map((i) => String(i?.texto || i?.conteudo || i?.resumo || ''))
    .join(' ')
    .toUpperCase();
  const baixa =
    /BAIXA\s+DEFINITIVA|BAIXA\s+DO\s+PROCESSO|ARQUIVAMENTO|TRANSITO\s+EM\s+JULGADO|TRÂNSITO\s+EM\s+JULGADO|EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO|PROCESSO\s+EXTINTO|IMPROCEDENTE|JULGO\s+IMPROCEDENTE/.test(
      blob
    );
  const residual =
    /PROCEDENTE/.test(blob) && !/IMPROCEDENTE/.test(blob)
      ? true
      : /CUMPRIMENTO\s+DE\s+SENTEN|BUSCA\s+E\s+APREEN|MANDADO\s+DE\s+BUSCA/.test(blob);
  if (baixa && !residual) {
    return { ok: true, motivo: 'DJEN: baixa/extinção/trânsito sem residual' };
  }
  return { ok: false, motivo: residual ? 'DJEN residual' : '' };
}

export async function countAutoEncerrarPendentesAction(): Promise<{
  success: boolean;
  baixaLimpaPendentes: number;
  revisaoPendentes: number;
  totalPendentes: number;
  error?: string;
}> {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id)
      return {
        success: false,
        baixaLimpaPendentes: 0,
        revisaoPendentes: 0,
        totalPendentes: 0,
        error: 'Sem sessão',
      };
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from('processos')
      .select(
        'id, dados, status, status_interno, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario'
      )
      .eq('empresa_id', empresa_id)
      .eq('datajud_encerrado_tribunal', true)
      .limit(8000);
    if (error)
      return {
        success: false,
        baixaLimpaPendentes: 0,
        revisaoPendentes: 0,
        totalPendentes: 0,
        error: error.message,
      };

    let limpa = 0;
    let revisao = 0;
    for (const row of data || []) {
      const d = row.dados && typeof row.dados === 'object' ? row.dados : {};
      if (isJaEncerradoRow(row, d)) continue;
      if (temResidualForte(row, d)) revisao++;
      else limpa++;
    }
    return {
      success: true,
      baixaLimpaPendentes: limpa,
      revisaoPendentes: revisao,
      totalPendentes: limpa + revisao,
    };
  } catch (e: any) {
    return {
      success: false,
      baixaLimpaPendentes: 0,
      revisaoPendentes: 0,
      totalPendentes: 0,
      error: e?.message || String(e),
    };
  }
}

async function persistAuto(
  admin: any,
  empresa_id: string,
  row: any,
  dados: any,
  motivo: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const target = {
    ...dados,
    id: row.id,
    protocolo: row.protocolo_ref || dados.protocolo,
    datajud_encerrado_tribunal: true,
  };
  const decisao = {
    acao: 'auto_encerrar' as const,
    motivo,
  };
  const patch = aplicarDecisaoNoPatch(
    { datajud_encerrado_tribunal: true },
    target,
    decisao
  );
  const newDados = {
    ...dados,
    ...(patch.dados || {}),
    situacao: 'ENCERRADO',
    statusManual: 'Encerrado',
    status: 'Arquivado',
    via_scan_auto_encerrar: true,
    scan_auto_encerrado_em: nowIso,
    scan_auto_encerrar_motivo: motivo,
    scan_auto_fonte: 'db_ou_djen', // nunca datajud neste fluxo
    operacao_sistema: patch.operacao_sistema || {
      origem: 'W1_CONTROL',
      perfil: 'W1 CONTROL',
      tipo: 'SCAN_AUTO_ENCERRAR',
      legenda: 'Feito por Davi Alves Figueredo · scanner automático',
    },
    proximoPrazo: '',
    diasFaltando: null,
  };
  const base = {
    dados: newDados,
    status: 'Arquivado',
    datajud_encerrado_tribunal: true,
  };
  let { error } = await admin
    .from('processos')
    .update({ ...base, status_interno: 'ENCERRADO' })
    .eq('id', row.id)
    .eq('empresa_id', empresa_id);
  if (error) {
    ({ error } = await admin
      .from('processos')
      .update(base)
      .eq('id', row.id)
      .eq('empresa_id', empresa_id));
  }
  return !error;
}

async function persistRevisao(
  admin: any,
  empresa_id: string,
  row: any,
  dados: any,
  motivo: string,
  prioridade: number
): Promise<boolean> {
  const newDados = {
    ...dados,
    precisa_revisar_encerramento: true,
    prioridade_revisao_encerrado: prioridade,
    scan_revisao_motivo: motivo,
  };
  const { error } = await admin
    .from('processos')
    .update({ dados: newDados })
    .eq('id', row.id)
    .eq('empresa_id', empresa_id);
  return !error;
}

/**
 * Lote sem DataJud.
 * 1) Usa flags já no banco (datajud_encerrado_tribunal + residual).
 * 2) Opcional: DJEN leve só se `usarDjenSeIncerto` e ainda sem decisão clara.
 */
export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  soBaixaTribunal?: boolean;
  marcarRevisao?: boolean;
  /** DJEN só para confirmar baixa quando o banco está ambíguo — NUNCA DataJud */
  usarDjenSeIncerto?: boolean;
}): Promise<{
  success: boolean;
  scanned: number;
  autoEncerrados: number;
  revisao: number;
  skipped: number;
  failed: number;
  djenConsultas: number;
  offset: number;
  nextOffset: number;
  totalCandidates: number;
  hasMore: boolean;
  percentDone: number;
  percentLeft: number;
  fonte: string;
  error?: string;
  samples?: string[];
}> {
  const empty = {
    success: false,
    scanned: 0,
    autoEncerrados: 0,
    revisao: 0,
    skipped: 0,
    failed: 0,
    djenConsultas: 0,
    offset: 0,
    nextOffset: 0,
    totalCandidates: 0,
    hasMore: false,
    percentDone: 0,
    percentLeft: 100,
    fonte: 'supabase',
  };
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: 'Sem sessão' };

    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 5), 80);
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const marcarRevisao = opts?.marcarRevisao !== false;
    // DJEN opcional e limitado (máx. 8 por lote) — nunca DataJud
    const usarDjen = opts?.usarDjenSeIncerto === true;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from('processos')
      .select(
        'id, protocolo_ref, dados, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno, procedente_motivo',
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .order('id', { ascending: true })
      .range(offset, offset + limit * 5 - 1);

    if (soBaixa) q = q.eq('datajud_encerrado_tribunal', true);

    const { data: rows, error, count } = await q;
    if (error) {
      return { ...empty, offset, nextOffset: offset, error: error.message };
    }

    const totalCandidates = typeof count === 'number' ? count : offset + (rows?.length || 0);

    let autoEncerrados = 0;
    let revisao = 0;
    let skipped = 0;
    let failed = 0;
    let scanned = 0;
    let djenConsultas = 0;
    const samples: string[] = [];
    let djenBudget = usarDjen ? 8 : 0;

    for (const row of rows || []) {
      if (scanned >= limit) break;
      const dados = row.dados && typeof row.dados === 'object' ? { ...row.dados } : {};
      if (isJaEncerradoRow(row, dados)) {
        skipped++;
        continue;
      }

      const temBaixaDb = !!(row.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal);
      if (!temBaixaDb && !usarDjen) {
        skipped++;
        continue;
      }

      scanned++;

      // --- Caminho A: já temos baixa no banco ---
      if (temBaixaDb) {
        if (temResidualForte(row, dados)) {
          if (marcarRevisao) {
            const ok = await persistRevisao(
              admin,
              empresa_id,
              row,
              dados,
              'Baixa no tribunal + residual (procedente/CS/B.A.) — sem DataJud',
              85
            );
            if (ok) {
              revisao++;
              if (samples.length < 8) samples.push(`${row.protocolo_ref} · REVISAR`);
            } else failed++;
          } else skipped++;
          continue;
        }

        const ok = await persistAuto(
          admin,
          empresa_id,
          row,
          dados,
          String(
            dados.datajud_encerrado_motivo ||
              row.procedente_motivo ||
              'Baixa limpa no banco — auto gabinete (sem DataJud)'
          )
        );
        if (ok) {
          autoEncerrados++;
          if (samples.length < 8) samples.push(`${row.protocolo_ref} · AUTO/DB`);
        } else failed++;
        continue;
      }

      // --- Caminho B: sem baixa no DB → só DJEN (se habilitado e budget) ---
      if (djenBudget <= 0) {
        skipped++;
        continue;
      }
      const proto = String(row.protocolo_ref || dados.protocolo || '').trim();
      if (!proto) {
        skipped++;
        continue;
      }
      try {
        djenBudget--;
        djenConsultas++;
        const djenRes = await fetchDjenComunicacoes(proto, { limit: 12 } as any);
        const items = (djenRes as any)?.items || (djenRes as any)?.comunicacoes || [];
        const sug = djenSugereEncerrado(items);
        if (sug.ok) {
          const ok = await persistAuto(admin, empresa_id, row, dados, sug.motivo);
          if (ok) {
            autoEncerrados++;
            if (samples.length < 8) samples.push(`${proto} · AUTO/DJEN`);
          } else failed++;
        } else if (sug.motivo.includes('residual') && marcarRevisao) {
          const ok = await persistRevisao(admin, empresa_id, row, dados, sug.motivo, 80);
          if (ok) {
            revisao++;
            if (samples.length < 8) samples.push(`${proto} · REVISAR/DJEN`);
          } else failed++;
        } else {
          skipped++;
        }
      } catch {
        failed++;
      }
    }

    const rowsRead = (rows || []).length;
    const nextOffset = offset + Math.max(rowsRead, 1);
    const hasMore = rowsRead >= limit || (rowsRead > 0 && nextOffset < totalCandidates);
    const denom = Math.max(totalCandidates, 1);
    const percentDone = Math.min(100, Math.round((nextOffset / denom) * 100));
    const percentLeft = Math.max(0, 100 - percentDone);

    return {
      success: true,
      scanned,
      autoEncerrados,
      revisao,
      skipped,
      failed,
      djenConsultas,
      offset,
      nextOffset,
      totalCandidates,
      hasMore,
      percentDone,
      percentLeft,
      fonte: djenConsultas > 0 ? 'supabase+djen' : 'supabase',
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
