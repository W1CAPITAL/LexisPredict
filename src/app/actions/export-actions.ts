'use server';

/**
 * Exportação resiliente: CSV + XLS (fórmulas) + XLSX.
 * Sempre devolve base64 (contrato da UI em cases/page.tsx).
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import {
  buildSpreadsheetMl,
  buildXlsxBase64,
  rowsToCsv,
  toBase64Utf8,
} from '@/lib/spreadsheet-io';

type Row = Record<string, any>;

function pickRows(rows: Row[]) {
  return rows.map((r) => ({
    protocolo: r.protocolo || r.protocolo_ref || '',
    cliente: r.cliente || '',
    telefone: r.telefone || '',
    tribunal: r.tribunal || '',
    status: r.status || r.status_prazo || '',
    escritorio: r.escritorio || '',
    advogado: r.advogado || '',
    ultimo_retorno: r.ultimoRetorno || r.ultimo_retorno || '',
    proximo_prazo: r.proximoRetorno || r.proximo_retorno || '',
    evento_tipo: r.evento_tipo || '',
    evento_resumo: r.evento_resumo || '',
    datajud_ultimo_nome: r.datajud_ultimo_nome || '',
    novo_andamento: r.tem_novo_andamento || r.tem_atualizacao_pos_retorno ? 'SIM' : 'NAO',
    encerrado: r.datajud_encerrado_tribunal ? 'SIM' : 'NAO',
    ba: r.indicio_busca_apreensao ? 'SIM' : 'NAO',
    cumprimento: r.em_cumprimento_sentenca ? 'SIM' : 'NAO',
    djen_resumo: r.djen_ultimo_resumo || '',
    observacoes: String(r.observacao || r.observacoes || '').replace(/\n/g, ' '),
  }));
}

const HEADERS = [
  'Protocolo',
  'Cliente',
  'Telefone',
  'Tribunal',
  'Status',
  'Escritorio',
  'Advogado',
  'Ultimo_Retorno',
  'Proximo_Prazo',
  'Evento_Tipo',
  'Evento_Resumo',
  'DataJud_Ultimo',
  'Novo_Andamento',
  'Encerrado_Tribunal',
  'Busca_Apreensao',
  'Cumprimento',
  'DJEN_Resumo',
  'Observacoes',
];

function toMatrix(normalized: ReturnType<typeof pickRows>): any[][] {
  return normalized.map((r) => [
    r.protocolo,
    r.cliente,
    r.telefone,
    r.tribunal,
    r.status,
    r.escritorio,
    r.advogado,
    r.ultimo_retorno,
    r.proximo_prazo,
    r.evento_tipo,
    r.evento_resumo,
    r.datajud_ultimo_nome,
    r.novo_andamento,
    r.encerrado,
    r.ba,
    r.cumprimento,
    r.djen_resumo,
    r.observacoes,
  ]);
}

async function loadRows(): Promise<Row[]> {
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

    if (!error && data && data.length > 0) return data as Row[];
  } catch {
    // fallback abaixo
  }

  const stored = await getStoredCasesForEmpresa(empresa_id);
  if (stored && stored.length > 0) return stored as Row[];

  throw new Error('Nenhum registro localizado no repositório.');
}

/** CSV — contrato cases/page: { success, base64, filename } */
export async function exportCasesToCSVAction() {
  try {
    const rows = await loadRows();
    const normalized = pickRows(rows);
    const matrix = toMatrix(normalized);
    const csv = rowsToCsv(HEADERS, matrix);
    const day = new Date().toISOString().slice(0, 10);
    return {
      success: true as const,
      base64: toBase64Utf8(csv),
      filename: `Gabinete_LexisPredict_${day}.csv`,
      mime: 'text/csv;charset=utf-8',
      count: normalized.length,
    };
  } catch (error: any) {
    console.error('[Export CSV]', error);
    return { success: false as const, error: error?.message || 'Falha na exportação CSV' };
  }
}

/** XLS multi-aba (Dashboard + Processos + Status) com métricas */
export async function exportCasesWorkbookAction() {
  try {
    const rows = await loadRows();
    const normalized = pickRows(rows);
    const matrix = toMatrix(normalized);

    const statusMap = new Map<string, number>();
    const escMap = new Map<string, number>();
    let and = 0,
      enc = 0,
      ba = 0,
      cump = 0;
    for (const r of normalized) {
      statusMap.set(r.status || '—', (statusMap.get(r.status || '—') || 0) + 1);
      escMap.set(r.escritorio || 'Sem escritório', (escMap.get(r.escritorio || 'Sem escritório') || 0) + 1);
      if (r.novo_andamento === 'SIM') and++;
      if (r.encerrado === 'SIM') enc++;
      if (r.ba === 'SIM') ba++;
      if (r.cumprimento === 'SIM') cump++;
    }

    const dashHeaders = ['KPI', 'Valor'];
    const dashRows: any[][] = [
      ['Total processos', normalized.length],
      ['Novos andamentos', and],
      ['Encerrados tribunal', enc],
      ['Indício B.A.', ba],
      ['Cumprimento sentença', cump],
      ['Gerado em', new Date().toISOString()],
    ];

    const xml = buildSpreadsheetMl([
      { name: 'Dashboard', headers: dashHeaders, rows: dashRows },
      { name: 'Processos', headers: HEADERS, rows: matrix },
      {
        name: 'Por_Status',
        headers: ['Status', 'Quantidade'],
        rows: [...statusMap.entries()],
      },
      {
        name: 'Por_Escritorio',
        headers: ['Escritorio', 'Quantidade'],
        rows: [...escMap.entries()],
      },
    ]);

    const day = new Date().toISOString().slice(0, 10);
    return {
      success: true as const,
      base64: toBase64Utf8(xml),
      filename: `Lexis_Dossie_${day}.xls`,
      mime: 'application/vnd.ms-excel',
      count: normalized.length,
    };
  } catch (error: any) {
    console.error('[Export XLS]', error);
    return { success: false as const, error: error?.message || 'Falha na planilha XLS' };
  }
}

/** XLSX real (1 aba Processos) */
export async function exportCasesXlsxAction() {
  try {
    const rows = await loadRows();
    const matrix = toMatrix(pickRows(rows));
    const base64 = await buildXlsxBase64(HEADERS, matrix);
    const day = new Date().toISOString().slice(0, 10);
    return {
      success: true as const,
      base64,
      filename: `Gabinete_LexisPredict_${day}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: matrix.length,
    };
  } catch (error: any) {
    console.error('[Export XLSX]', error);
    return { success: false as const, error: error?.message || 'Falha na exportação XLSX' };
  }
}
