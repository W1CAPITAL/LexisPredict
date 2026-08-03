'use server';

/**
 * @fileOverview Exportação CSV + XLSX (SheetJS)
 * CSV intacto · XLSX via biblioteca `xlsx`
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';

type Row = Record<string, any>;

const HEADERS = [
  'ID',
  'DATA CRIAÇÃO',
  'EMPRESA ID',
  'CRIADO POR',
  'ÚLTIMO RETORNO',
  'PRÓXIMO PRAZO',
  'OBSERVAÇÕES',
  'STATUS',
  'RISCO',
  'STATUS INTERNO',
  'ULTIMA MOVIMENTAÇÃO',
  'ESCRITÓRIO',
  'ADVOGADO',
  'DATA DISTRIBUIÇÃO',
  'PRODUTOS',
  'TELEFONE',
  'PROTOCOLO REF',
  'TRIBUNAL',
  'STATUS PRAZO',
  'DATAJUD ÚLTIMO MOVIMENTO',
  'DATAJUD ÚLTIMO NOME',
  'DATAJUD CONSULTADO EM',
  'ALERTA DATAJUD',
  'ENCERRADO TRIBUNAL',
  'MOTIVO ENCERRAMENTO',
  'INDICIO B.A.',
  'BA CONFIANÇA',
  'BA MOTIVO',
  'BA CONSULTADO EM',
  'FASE EXECUTIVA',
  'MOTIVO EXECUÇÃO',
  'DJEN CONSULTADO EM',
  'NOVA COMUNICAÇÃO DJEN',
  'DJEN ÚLTIMA DATA',
  'DJEN ÚLTIMO RESUMO',
  'DJEN LINK',
  'DJEN CONTAGEM',
] as const;

function rowToCells(r: Row): (string | number)[] {
  return [
    r.id,
    r.created_at,
    r.empresa_id,
    r.created_by,
    r.ultimo_retorno ?? r.ultimoRetorno,
    r.proximo_retorno ?? r.proximoRetorno,
    String(r.observacoes ?? r.observacao ?? '').replace(/\n/g, ' '),
    r.status,
    r.risco,
    r.status_interno,
    r.ultima_movimentacao ?? r.evento_resumo,
    r.escritorio,
    r.advogado,
    r.data_distribuicao,
    r.produtos,
    r.telefone,
    r.protocolo_ref ?? r.protocolo,
    r.tribunal,
    r.status_prazo ?? r.status,
    r.datajud_ultimo_movimento,
    r.datajud_ultimo_nome,
    r.datajud_consultado_em,
    r.tem_atualizacao_pos_retorno || r.tem_novo_andamento ? 'SIM' : 'NÃO',
    r.datajud_encerrado_tribunal ? 'SIM' : 'NÃO',
    r.datajud_encerrado_motivo,
    r.indicio_busca_apreensao ? 'SIM' : 'NÃO',
    r.busca_apreensao_confianca,
    r.busca_apreensao_motivo,
    r.busca_apreensao_consultado_em,
    r.em_cumprimento_sentenca ? 'SIM' : 'NÃO',
    r.cumprimento_sentenca_motivo,
    r.djen_consultado_em,
    r.djen_nova_comunicacao ? 'SIM' : 'NÃO',
    r.djen_ultima_data,
    r.djen_ultimo_resumo,
    r.djen_ultimo_link,
    r.djen_count,
  ].map((v) => (v == null ? '' : v));
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
    if (!error && data?.length) return data as Row[];
  } catch {
    // fallback
  }

  try {
    const stored = await getStoredCasesForEmpresa(empresa_id);
    if (stored?.length) return stored as Row[];
  } catch {
    //
  }

  throw new Error('Nenhum registro localizado no repositório.');
}

/** CSV — botão Extrair Planilha (inalterado no contrato da UI) */
export async function exportCasesToCSVAction() {
  try {
    const rows = await loadRows();
    const csvContentRows = rows.map((r) =>
      rowToCells(r)
        .map((field) => `"${String(field ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const finalCsv = '\uFEFF' + [HEADERS.join(','), ...csvContentRows].join('\n');
    const day = new Date().toISOString().split('T')[0];
    return {
      success: true as const,
      base64: Buffer.from(finalCsv, 'utf-8').toString('base64'),
      filename: `Gabinete_LexisPredict_${day}.csv`,
      mime: 'text/csv;charset=utf-8',
      count: rows.length,
    };
  } catch (error: any) {
    console.error('[Export CSV]', error);
    return { success: false as const, error: error?.message || 'Falha CSV' };
  }
}

/**
 * XLSX via SheetJS (`xlsx`).
 * npm i xlsx
 */
export async function exportCasesToXlsxAction() {
  try {
    const rows = await loadRows();

    // Import dinâmico — evita falha se o módulo ainda não estiver no bundle de types
    const XLSX = await import('xlsx');

    const aoa: (string | number)[][] = [
      [...HEADERS],
      ...rows.map((r) => rowToCells(r).map((c) => (typeof c === 'number' ? c : String(c ?? '')))),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // larguras básicas
    ws['!cols'] = HEADERS.map((h) => ({ wch: Math.min(28, Math.max(12, h.length + 2)) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Processos');

    // aba resumo
    const total = rows.length;
    let and = 0,
      enc = 0,
      ba = 0;
    for (const r of rows) {
      if (r.tem_atualizacao_pos_retorno || r.tem_novo_andamento) and++;
      if (r.datajud_encerrado_tribunal) enc++;
      if (r.indicio_busca_apreensao) ba++;
    }
    const dash = XLSX.utils.aoa_to_sheet([
      ['KPI', 'Valor'],
      ['Total processos', total],
      ['Novos andamentos', and],
      ['Encerrados tribunal', enc],
      ['Indício B.A.', ba],
      ['Gerado em', new Date().toISOString()],
    ]);
    XLSX.utils.book_append_sheet(wb, dash, 'Dashboard');

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const day = new Date().toISOString().split('T')[0];

    return {
      success: true as const,
      base64: Buffer.from(buf).toString('base64'),
      filename: `Gabinete_LexisPredict_${day}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      count: total,
    };
  } catch (error: any) {
    console.error('[Export XLSX]', error);
    return {
      success: false as const,
      error:
        error?.message ||
        'Falha ao gerar XLSX. Confirme: npm i xlsx && redeploy.',
    };
  }
}

/** Alias usado em alguns patches */
export async function exportDossieXlsxAction() {
  return exportCasesToXlsxAction();
}
