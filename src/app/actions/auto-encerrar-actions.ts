'use server';

/**
 * Auto-encerrar: prioriza ARQUIVAR baixa limpa no banco (sem DataJud).
 * Residual FORTE (CS ativo / B.A. real) → só revisar.
 * is_procedente sozinho NÃO bloqueia auto (flag costuma ficar suja após baixa).
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { aplicarDecisaoNoPatch } from '@/lib/auto-encerrar-scan';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';
import { fetchDjenComunicacoes } from '@/lib/djen';

const PAGE = 60;

function truthyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'sim' || s === 'yes';
}

function isJaEncerradoRow(row: any, dados: any): boolean {
  if (truthyFlag(dados?.via_scan_auto_encerrar)) return true;
  const sit = String(dados?.situacao || row.status_interno || '').toUpperCase();
  if (/^ENCERRAD|^ARQUIVAD|EXTINT|FINALIZ/.test(sit)) return true;
  const st = String(row.status || dados?.status || '').toUpperCase();
  if (/^ARQUIVAD|^ENCERRAD/.test(st)) return true;
  try {
    const c = processarCaso({
      ...dados,
      protocolo: row.protocolo_ref || dados?.protocolo,
      datajud_encerrado_tribunal: row.datajud_encerrado_tribunal,
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

/**
 * Só impede auto-encerrar se ainda há trabalho operacional claro.
 * NÃO usa is_procedente isolado (gera 0 auto na prática).
 */
function residualImpedeAuto(row: any, dados: any): { impede: boolean; motivo: string; prioridade: number } {
  if (truthyFlag(row.em_cumprimento_sentenca) || truthyFlag(dados?.em_cumprimento_sentenca)) {
    return { impede: true, motivo: 'Cumprimento de sentença ativo', prioridade: 92 };
  }
  if (truthyFlag(dados?.cumprimento_ativo) || truthyFlag(row.cumprimento_ativo)) {
    return { impede: true, motivo: 'Cumprimento ativo (flag)', prioridade: 90 };
  }
  if (truthyFlag(dados?.indicio_busca_apreensao) || truthyFlag(row.indicio_busca_apreensao)) {
    return { impede: true, motivo: 'Indício B.A.', prioridade: 95 };
  }
  // cumprimento pendente + oportunidade alta
  if (
    truthyFlag(row.cumprimento_pendente_necessario) ||
    truthyFlag(dados?.cumprimento_pendente_necessario)
  ) {
    const score = Number(dados?.oportunidade_score ?? dados?.oportunidade_instaurar?.score ?? 0);
    if (score >= 55 || truthyFlag(dados?.oportunidade_elegivel)) {
      return {
        impede: true,
        motivo: 'Falta instaurar cumprimento (oportunidade)',
        prioridade: 88,
      };
    }
  }
  return { impede: false, motivo: '', prioridade: 0 };
}

export async function countAutoEncerrarPendentesAction(): Promise<{
  success: boolean;
  baixaLimpaPendentes: number;
  revisaoPendentes: number;
  totalPendentes: number;
  baixasTribunalTotal: number;
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
        baixasTribunalTotal: 0,
        error: 'Sem sessão',
      };
    const admin = await getSupabaseAdmin();
    const { data, error } = await admin
      .from('processos')
      .select(
        'id, dados, status, status_interno, datajud_encerrado_tribunal, em_cumprimento_sentenca, cumprimento_pendente_necessario'
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
        baixasTribunalTotal: 0,
        error: error.message,
      };

    let limpa = 0;
    let revisao = 0;
    let totalBaixa = 0;
    for (const row of data || []) {
      totalBaixa++;
      const d = row.dados && typeof row.dados === 'object' ? row.dados : {};
      if (isJaEncerradoRow(row, d)) continue;
      const r = residualImpedeAuto(row, d);
      if (r.impede) revisao++;
      else limpa++;
    }
    return {
      success: true,
      baixaLimpaPendentes: limpa,
      revisaoPendentes: revisao,
      totalPendentes: limpa + revisao,
      baixasTribunalTotal: totalBaixa,
    };
  } catch (e: any) {
    return {
      success: false,
      baixaLimpaPendentes: 0,
      revisaoPendentes: 0,
      totalPendentes: 0,
      baixasTribunalTotal: 0,
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
): Promise<{ ok: boolean; err?: string }> {
  const nowIso = new Date().toISOString();
  const target = {
    ...dados,
    id: row.id,
    protocolo: row.protocolo_ref || dados.protocolo,
    datajud_encerrado_tribunal: true,
  };
  const patch = aplicarDecisaoNoPatch(
    { datajud_encerrado_tribunal: true },
    target,
    { acao: 'auto_encerrar', motivo }
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
    scan_auto_fonte: 'db',
    operacao_sistema: patch.operacao_sistema || {
      origem: 'W1_CONTROL',
      perfil: 'W1 CONTROL',
      tipo: 'SCAN_AUTO_ENCERRAR',
      legenda: 'Feito por Davi Alves Figueredo · scanner automático',
    },
    proximoPrazo: '',
    diasFaltando: null,
    precisa_revisar_encerramento: false,
  };
  const base: Record<string, any> = {
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
    ({ error } = await admin.from('processos').update(base).eq('id', row.id).eq('empresa_id', empresa_id));
  }
  return { ok: !error, err: error?.message };
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

function djenSugereEncerrado(items: any[]): { ok: boolean; motivo: string } {
  if (!items?.length) return { ok: false, motivo: '' };
  const blob = items
    .slice(0, 10)
    .map((i) => String(i?.texto || i?.conteudo || i?.resumo || ''))
    .join(' ')
    .toUpperCase();
  const baixa =
    /BAIXA\s+DEFINITIVA|BAIXA\s+DO\s+PROCESSO|ARQUIVAMENTO|TRANSITO\s+EM\s+JULGADO|TRÂNSITO\s+EM\s+JULGADO|EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO|PROCESSO\s+EXTINTO|JULGO\s+IMPROCEDENTE|IMPROCED[EÊ]NCIA/.test(
      blob
    );
  const residualForte =
    /CUMPRIMENTO\s+DE\s+SENTEN|BUSCA\s+E\s+APREEN|MANDADO\s+DE\s+BUSCA|PENHORA/.test(blob);
  if (baixa && !residualForte) return { ok: true, motivo: 'DJEN: baixa/extinção/trânsito' };
  return { ok: false, motivo: residualForte ? 'DJEN residual forte' : '' };
}

export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  soBaixaTribunal?: boolean;
  marcarRevisao?: boolean;
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
  lastError?: string;
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

    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 5), 100);
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const marcarRevisao = opts?.marcarRevisao !== false;
    const usarDjen = opts?.usarDjenSeIncerto === true;
    const admin = await getSupabaseAdmin();

    // Busca só quem ainda NÃO está Arquivado (candidatos reais)
    let q = admin
      .from('processos')
      .select(
        'id, protocolo_ref, dados, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno',
        { count: 'exact' }
      )
      .eq('empresa_id', empresa_id)
      .order('id', { ascending: true })
      .range(offset, offset + limit * 4 - 1);

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
    let lastError = '';
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
      if (!temBaixaDb) {
        skipped++;
        continue;
      }

      scanned++;
      const residual = residualImpedeAuto(row, dados);

      if (residual.impede) {
        if (marcarRevisao) {
          const ok = await persistRevisao(
            admin,
            empresa_id,
            row,
            dados,
            residual.motivo,
            residual.prioridade
          );
          if (ok) {
            revisao++;
            if (samples.length < 10) samples.push(`${row.protocolo_ref} · REVISAR:${residual.motivo}`);
          } else failed++;
        } else skipped++;
        continue;
      }

      // AUTO — baixa no tribunal + ainda ativo no app
      const res = await persistAuto(
        admin,
        empresa_id,
        row,
        dados,
        String(
          dados.datajud_encerrado_motivo ||
            'Baixa no tribunal — auto gabinete W1 (sem DataJud)'
        )
      );
      if (res.ok) {
        autoEncerrados++;
        if (samples.length < 10) samples.push(`${row.protocolo_ref} · AUTO`);
      } else {
        failed++;
        lastError = res.err || 'update fail';
      }
    }

    // DJEN opcional: só se budget e offset já passou baixas sem decisão
    if (usarDjen && djenBudget > 0 && autoEncerrados === 0 && scanned < limit) {
      /* reserved — lote principal já cobre baixa DB */
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
      skipped,
      failed,
      djenConsultas,
      offset,
      nextOffset,
      totalCandidates,
      hasMore,
      percentDone,
      percentLeft: Math.max(0, 100 - percentDone),
      fonte: 'supabase',
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
