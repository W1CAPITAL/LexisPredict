'use server';

/**
 * Auto-encerrar em lotes — só candidatos com baixa tribunal clara.
 * Caminho rápido no DB (sem DataJud em massa) para não mexer em casos saudáveis.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { decidirEncerramentoScan, aplicarDecisaoNoPatch } from '@/lib/auto-encerrar-scan';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { processarCaso } from '@/lib/case-logic';

const PAGE = 40;

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

/** Tem residual que NÃO deve auto-arquivar (precisa humano). */
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

export async function countAutoEncerrarPendentesAction(): Promise<{
  success: boolean;
  /** Baixa limpa ainda ativa → candidatos a AUTO */
  baixaLimpaPendentes: number;
  /** Baixa + residual → só revisão (não auto) */
  revisaoPendentes: number;
  /** Total que o botão “empresa toda” ainda precisa olhar */
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

/**
 * Aplica auto-encerrar / flag de revisão a partir do que já está no banco.
 * Não chama DataJud em massa (não “sorteia” processo saudável).
 */
export async function runAutoEncerrarBatchAction(opts?: {
  limit?: number;
  offset?: number;
  /** default true: só quem tem datajud_encerrado_tribunal */
  soBaixaTribunal?: boolean;
  /** se true, também marca residual como precisa_revisar (sem arquivar) */
  marcarRevisao?: boolean;
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
    offset: 0,
    nextOffset: 0,
    totalCandidates: 0,
    hasMore: false,
    percentDone: 0,
    percentLeft: 100,
  };
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { ...empty, error: 'Sem sessão' };

    const limit = Math.min(Math.max(opts?.limit ?? PAGE, 5), 80);
    const offset = Math.max(0, opts?.offset ?? 0);
    const soBaixa = opts?.soBaixaTribunal !== false;
    const marcarRevisao = opts?.marcarRevisao !== false;
    const admin = await getSupabaseAdmin();

    let q = admin
      .from('processos')
      .select(
        'id, protocolo_ref, dados, datajud_encerrado_tribunal, is_procedente, em_cumprimento_sentenca, cumprimento_pendente_necessario, status, status_interno, procedente_motivo',
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

    let autoEncerrados = 0;
    let revisao = 0;
    let skipped = 0;
    let failed = 0;
    let scanned = 0;
    const samples: string[] = [];

    for (const row of rows || []) {
      if (scanned >= limit) break;
      const dados = row.dados && typeof row.dados === 'object' ? { ...row.dados } : {};
      if (isJaEncerradoRow(row, dados)) {
        skipped++;
        continue;
      }
      if (!row.datajud_encerrado_tribunal && !dados.datajud_encerrado_tribunal) {
        skipped++;
        continue;
      }

      scanned++;
      const target = {
        ...dados,
        id: row.id,
        protocolo: row.protocolo_ref || dados.protocolo,
        datajud_encerrado_tribunal: true,
        is_procedente: row.is_procedente ?? dados.is_procedente,
        em_cumprimento_sentenca: row.em_cumprimento_sentenca ?? dados.em_cumprimento_sentenca,
        cumprimento_pendente_necessario:
          row.cumprimento_pendente_necessario ?? dados.cumprimento_pendente_necessario,
        situacao: dados.situacao || row.status_interno,
        status: row.status,
        procedente_motivo: row.procedente_motivo || dados.procedente_motivo,
      };

      const decisao = decidirEncerramentoScan({
        target,
        patch: {
          datajud_encerrado_tribunal: true,
          is_procedente: target.is_procedente,
          em_cumprimento_sentenca: target.em_cumprimento_sentenca,
          cumprimento_pendente_necessario: target.cumprimento_pendente_necessario,
        },
      });

      if (decisao.acao === 'nenhuma') {
        skipped++;
        continue;
      }

      if (decisao.acao === 'revisao_fila') {
        if (!marcarRevisao) {
          skipped++;
          continue;
        }
        try {
          const patch = aplicarDecisaoNoPatch({}, target, decisao);
          const newDados = {
            ...dados,
            ...(patch.dados || {}),
            precisa_revisar_encerramento: true,
            prioridade_revisao_encerrado: decisao.prioridade,
            scan_revisao_motivo: decisao.motivo,
          };
          const { error: upErr } = await admin
            .from('processos')
            .update({ dados: newDados })
            .eq('id', row.id)
            .eq('empresa_id', empresa_id);
          if (upErr) failed++;
          else {
            revisao++;
            if (samples.length < 8) samples.push(`${row.protocolo_ref} · REVISAR`);
          }
        } catch {
          failed++;
        }
        continue;
      }

      // auto_encerrar — só baixa limpa
      try {
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
          scan_auto_encerrado_em: patch.scan_auto_encerrado_em || new Date().toISOString(),
          scan_auto_encerrar_motivo: decisao.motivo,
          operacao_sistema: patch.operacao_sistema || {
            origem: 'W1_CONTROL',
            perfil: 'W1 CONTROL',
            tipo: 'SCAN_AUTO_ENCERRAR',
            legenda: 'Feito por Davi Alves Figueredo · scanner automático',
          },
          proximoPrazo: '',
          diasFaltando: null,
        };
        const updatePayload: Record<string, any> = {
          dados: newDados,
          status: 'Arquivado',
          datajud_encerrado_tribunal: true,
        };
        // status_interno se a coluna existir no schema (ignore se falhar)
        try {
          updatePayload.status_interno = 'ENCERRADO';
        } catch {
          /* */
        }

        const { error: upErr } = await admin
          .from('processos')
          .update(updatePayload)
          .eq('id', row.id)
          .eq('empresa_id', empresa_id);
        if (upErr) {
          // retry sem status_interno
          const { error: up2 } = await admin
            .from('processos')
            .update({
              dados: newDados,
              status: 'Arquivado',
              datajud_encerrado_tribunal: true,
            })
            .eq('id', row.id)
            .eq('empresa_id', empresa_id);
          if (up2) failed++;
          else {
            autoEncerrados++;
            if (samples.length < 8) samples.push(`${row.protocolo_ref} · AUTO`);
          }
        } else {
          autoEncerrados++;
          if (samples.length < 8) samples.push(`${row.protocolo_ref} · AUTO`);
        }
      } catch {
        failed++;
      }
    }

    const rowsRead = (rows || []).length;
    const nextOffset = offset + Math.max(rowsRead, 1);
    const hasMore = rowsRead >= limit;
    // progresso aproximado pelo offset na lista de baixas tribunal
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
      offset,
      nextOffset,
      totalCandidates,
      hasMore: hasMore || (rowsRead > 0 && scanned > 0 && nextOffset < totalCandidates),
      percentDone,
      percentLeft,
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
