'use server';

/**
 * Exportação operacional — CSV legado + Workbook Excel (XML) com fórmulas e abas de gráfico.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/server-db';
import { buildOperationalWorkbookXml } from '@/lib/export-workbook-xml';

function toCsvCell(field: any): string {
  const val = String(field ?? '').replace(/"/g, '""');
  return `"${val}"`;
}

export async function exportCasesToCSVAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, error: 'Sessão expirada. Refaça o login.' };
    }

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('processos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return { success: false, error: 'Nenhum registro localizado no repositório.' };
    }

    const headers = [
      'Protocolo',
      'Cliente',
      'Telefone',
      'Tribunal',
      'Status',
      'Escritorio',
      'Advogado',
      'Ultimo_Retorno',
      'Evento_Tipo',
      'Evento_Resumo',
      'Novo_Andamento',
      'Encerrado_Tribunal',
      'Busca_Apreensao',
      'Cumprimento_Sentenca',
      'DJEN_Resumo',
    ];

    const body = rows.map((r: any) =>
      [
        r.protocolo_ref || r.protocolo,
        r.cliente,
        r.telefone,
        r.tribunal,
        r.status || r.status_prazo,
        r.escritorio,
        r.advogado,
        r.ultimo_retorno,
        r.evento_tipo,
        r.evento_resumo,
        r.tem_atualizacao_pos_retorno || r.tem_novo_andamento ? 'SIM' : 'NAO',
        r.datajud_encerrado_tribunal ? 'SIM' : 'NAO',
        r.indicio_busca_apreensao ? 'SIM' : 'NAO',
        r.em_cumprimento_sentenca ? 'SIM' : 'NAO',
        r.djen_ultimo_resumo,
      ]
        .map(toCsvCell)
        .join(',')
    );

    const csv = '\uFEFF' + [headers.join(','), ...body].join('\n');
    const filename = `lexis_processos_${new Date().toISOString().slice(0, 10)}.csv`;

    return { success: true, csv, filename, mime: 'text/csv;charset=utf-8' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha na exportação CSV' };
  }
}

/** Planilha rica (.xls SpreadsheetML) — Dashboard + fórmulas + tabelas para gráfico */
export async function exportCasesWorkbookAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, error: 'Sessão expirada.' };
    }

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('processos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows?.length) {
      return { success: false, error: 'Nenhum processo para exportar.' };
    }

    const xml = buildOperationalWorkbookXml(rows);
    const filename = `lexis_dossie_${new Date().toISOString().slice(0, 10)}.xls`;

    return {
      success: true,
      xml,
      filename,
      mime: 'application/vnd.ms-excel',
      base64: Buffer.from(xml, 'utf8').toString('base64'),
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha na planilha' };
  }
}
