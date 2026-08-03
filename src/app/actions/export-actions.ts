'use server';

/**
 * @fileOverview Exportação CSV + XLSX Dossiê
 * IMPORTANTE: em arquivos "use server" só pode exportar async function —
 * NÃO use `export { x } from './outro'`.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { buildDossieXlsxBase64 } from '@/lib/xlsx-dossie-builder';
import { EXPORT_HEADERS } from '@/lib/xlsx-schema';

type Row = Record<string, any>;

async function loadCases(): Promise<Row[]> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) throw new Error('Sessão expirada. Refaça o login.');

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('processos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (!error && data?.length) return data as Row[];
  } catch {
    // fallback
  }

  const stored = await getStoredCasesForEmpresa(empresa_id);
  if (stored?.length) return stored as Row[];
  throw new Error('Nenhum processo na carteira para exportar.');
}

/** CSV — contrato UI: { success, base64, filename } */
export async function exportCasesToCSVAction() {
  try {
    const cases = await loadCases();
    const headers = [...EXPORT_HEADERS];
    const lines = [headers.join(',')];

    for (const r of cases) {
      const evento = String(r.evento_tipo || '');
      const cells = [
        r.protocolo || r.protocolo_ref,
        r.cliente,
        r.telefone,
        r.tribunal,
        r.status || r.status_prazo,
        r.escritorio,
        r.advogado,
        r.ultimoRetorno || r.ultimo_retorno,
        r.proximoRetorno || r.proximo_retorno,
        evento,
        r.evento_resumo,
        r.datajud_ultimo_nome,
        r.tem_novo_andamento || r.tem_atualizacao_pos_retorno ? 'SIM' : 'NAO',
        r.datajud_encerrado_tribunal ? 'SIM' : 'NAO',
        r.indicio_busca_apreensao ? 'SIM' : 'NAO',
        r.em_cumprimento_sentenca ? 'SIM' : 'NAO',
        evento === 'sentenca_procedente' ? 'SIM' : 'NAO',
        evento === 'sentenca_improcedente' ? 'SIM' : 'NAO',
        r.djen_ultimo_resumo,
        String(r.observacao || r.observacoes || '').replace(/\n/g, ' '),
      ].map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`);
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
  } catch (e: any) {
    console.error('[exportCasesToCSVAction]', e);
    return { success: false as const, error: e?.message || 'Falha CSV' };
  }
}

/** XLSX dossiê (Capa + Dashboard + Processos + Status + Escritório) */
export async function exportDossieXlsxAction() {
  try {
    const cases = await loadCases();
    const result = await buildDossieXlsxBase64(cases);
    return {
      success: true as const,
      base64: result.base64,
      filename: result.filename,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: result.count,
      kpis: result.kpis,
    };
  } catch (e: any) {
    console.error('[exportDossieXlsxAction]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar XLSX' };
  }
}

/** Alias */
export async function exportCasesXlsxAction() {
  return exportDossieXlsxAction();
}
