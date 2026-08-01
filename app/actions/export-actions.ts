'use server';

/**
 * @fileOverview Motor de Exportação Forense v110.0
 * Gera planilhas CSV compatíveis com Excel a partir do repositório Supabase.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { getStoredCases } from '@/lib/server-db';

export async function exportCasesToCSVAction() {
  try {
    const cases = await getStoredCases();

    if (!cases || cases.length === 0) {
      return { success: false, error: 'Nenhum processo encontrado para exportar.' };
    }

    // Cabeçalhos oficiais do Gabinete LexisPredict com coluna ESCRITORIO
    const headers = [
      'CLIENTE',
      'PROTOCOLO',
      'TELEFONE',
      'ADVOGADO',
      'ESCRITORIO',
      'SITUAÇÃO',
      'STATUS',
      'RISCO',
      'OBSERVAÇÕES',
      'ÚLTIMO RETORNO',
      'PRÓXIMO PRAZO',
      'TRIBUNAL',
    ];

    // Montagem das linhas com tratamento de aspas para CSV
    const rows = cases.map((c: any) => {
      return [
        c.cliente || '',
        c.protocolo || '',
        c.telefone || '',
        c.advogado || '',
        c.escritorio || '',
        c.situacao || '',
        c.status || '',
        c.risco || '',
        (c.observacao || '').replace(/\n/g, ' '),
        c.ultimoRetorno || '',
        c.proximoPrazo || '',
        c.tribunal || '',
      ]
        .map((field) => {
          // Escapa aspas e encapsula o campo para evitar quebras por vírgulas internas
          const value = String(field ?? '').replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Inclusão do BOM (Byte Order Mark) para compatibilidade nativa com Excel (UTF-8)
    const base64 = Buffer.from('\uFEFF' + csvContent, 'utf-8').toString('base64');

    return {
      success: true,
      base64,
      filename: `processos_lexis_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  } catch (error: any) {
    console.error('[Export] Falha na geração da planilha:', error);
    return { success: false, error: 'Erro interno ao processar a exportação.' };
  }
}
