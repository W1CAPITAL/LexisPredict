'use server';

/**
 * Exportação operacional — CSV + XLSX Dossiê
 * SEM id / created_at / empresa_id / created_by
 * Escopo: apenas carteira visível ao usuário logado (RLS + getStoredCasesForEmpresa)
 */

import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { buildDossieXlsxBase64 } from '@/lib/xlsx-dossie-builder';
import { EXPORT_HEADERS, tribunalFromProtocolo } from '@/lib/xlsx-schema';

type Row = Record<string, any>;

/** Carrega só o que o usuário logado pode ver */
async function loadCasesForSession(): Promise<{ cases: Row[]; email: string | null }> {
  const ctx = await getUserContext();
  const { empresa_id, email } = ctx;
  if (!empresa_id) throw new Error('Sessão expirada. Refaça o login.');

  // getStoredCasesForEmpresa já filtra por created_by se não for Master/Supervisor
  const stored = await getStoredCasesForEmpresa(empresa_id, false);
  if (stored?.length) return { cases: stored as Row[], email };

  throw new Error('Nenhum processo na carteira visível para exportar.');
}

function operationalCells(r: Row): (string | number)[] {
  const dados = (r.dados && typeof r.dados === 'object' ? r.dados : {}) as any;
  const protocolo = String(r.protocolo || r.protocolo_ref || dados.protocolo || '');
  const evento = String(r.evento_tipo || dados.evento_tipo || '');
  const status = String(r.status || r.status_prazo || dados.status || '');

  return [
    r.assistente || dados.assistente || r.atendente || '',
    r.escritorio || dados.escritorio || '',
    r.advogado || dados.advogado || '',
    r.cliente || dados.cliente || '',
    r.telefone || dados.telefone || '',
    protocolo,
    r.data_distribuicao || dados.data_distribuicao || '',
    status,
    String(r.observacao || r.observacoes || dados.observacao || '').replace(/\n/g, ' '),
    r.produtos || dados.produtos || '',
    r.datajud_ultimo_movimento || '',
    r.evento_resumo || r.datajud_ultimo_nome || '',
    r.ultimoRetorno || r.ultimo_retorno || '',
    r.proximoRetorno || r.proximo_retorno || r.proximoPrazo || '',
    tribunalFromProtocolo(protocolo, r.tribunal || dados.tribunal),
    evento,
    r.tem_novo_andamento || r.tem_atualizacao_pos_retorno || r.djen_nova_comunicacao ? 'SIM' : 'NAO',
    r.datajud_encerrado_tribunal ? 'SIM' : 'NAO',
    r.indicio_busca_apreensao ? 'SIM' : 'NAO',
    r.em_cumprimento_sentenca || evento === 'cumprimento_sentenca' ? 'SIM' : 'NAO',
    r.djen_ultimo_resumo || '',
    status,
  ].map((v) => (v == null ? '' : v));
}

/** CSV operacional (sem metadados internos) */
export async function exportCasesToCSVAction() {
  try {
    const { cases } = await loadCasesForSession();
    const lines = [EXPORT_HEADERS.join(',')];
    for (const r of cases) {
      const cells = operationalCells(r).map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`);
      lines.push(cells.join(','));
    }
    const csv = '\uFEFF' + lines.join('\n');
    const day = new Date().toISOString().slice(0, 10);
    return {
      success: true as const,
      base64: Buffer.from(csv, 'utf-8').toString('base64'),
      filename: `Gabinete_LexisPredict_${day}.csv`,
      mime: 'text/csv;charset=utf-8',
      count: cases.length,
    };
  } catch (error: any) {
    console.error('[Export CSV]', error);
    return { success: false as const, error: error?.message || 'Falha CSV' };
  }
}

/**
 * XLSX Dossiê — Capa + Analytics + Auditoria + Processos + Mapa_TJ + agregações
 * Botão "Exportar XLSX" / Dossiê Operacional
 */
export async function exportDossieXlsxAction() {
  try {
    const { cases, email } = await loadCasesForSession();
    const result = await buildDossieXlsxBase64(cases, { usuario: email || undefined });
    return {
      success: true as const,
      base64: result.base64,
      filename: result.filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: result.count,
      kpis: result.kpis,
    };
  } catch (e: any) {
    console.error('[exportDossieXlsx]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar XLSX' };
  }
}

/** Alias legados */
export async function exportCasesToXlsxAction() {
  return exportDossieXlsxAction();
}

export async function exportCasesXlsxAction() {
  return exportDossieXlsxAction();
}
