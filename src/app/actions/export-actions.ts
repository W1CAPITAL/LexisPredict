'use server';

/**
 * @fileOverview Motor de Exportação Forense v120.0
 * Gera planilhas CSV compatíveis com Excel a partir de todas as colunas do repositório.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/server-db';

export async function exportCasesToCSVAction() {
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, error: 'Sessão expirada. Refaça o login.' };
    }

    const supabase = await createClient();
    
    // Busca todas as colunas para exportação completa do gabinete
    const { data: rows, error } = await supabase
      .from('processos')
      .select('*')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return { success: false, error: 'Nenhum registro localizado no repositório.' };
    }

    // Cabeçalhos baseados na estrutura oficial fornecida
    const headers = [
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
      'DJEN CONTAGEM'
    ];

    // Mapeamento de linhas com sanitização de campos
    const csvContentRows = rows.map(r => {
      return [
        r.id,
        r.created_at,
        r.empresa_id,
        r.created_by,
        r.ultimo_retorno,
        r.proximo_retorno,
        (r.observacoes || '').replace(/\n/g, ' '),
        r.status,
        r.risco,
        r.status_interno,
        r.ultima_movimentacao,
        r.escritorio,
        r.advogado,
        r.data_distribuicao,
        r.produtos,
        r.telefone,
        r.protocolo_ref,
        r.tribunal,
        r.status_prazo,
        r.datajud_ultimo_movimento,
        r.datajud_ultimo_nome,
        r.datajud_consultado_em,
        r.tem_atualizacao_pos_retorno ? 'SIM' : 'NÃO',
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
        r.djen_count
      ].map(field => {
        const val = String(field ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
    });

    // Inclusão do BOM para compatibilidade com Excel/UTF-8
    const finalCsv = "\uFEFF" + [headers.join(','), ...csvContentRows].join('\n');

    return {
      success: true,
      base64: Buffer.from(finalCsv, 'utf-8').toString('base64'),
      filename: `Gabinete_LexisPredict_${new Date().toISOString().split('T')[0]}.csv`
    };
  } catch (error: any) {
    console.error('[Export Action] Fail:', error);
    return { success: false, error: error.message };
  }
}
