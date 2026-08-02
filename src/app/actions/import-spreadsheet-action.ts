'use server';

/**
 * Ingestão ampliada: CSV (como antes) + XLSX → CSV interno → importCsvAction.
 * Não reescreve o motor de mapeamento; só normaliza o arquivo de entrada.
 */

import { importCsvAction } from '@/app/actions/import-actions';
import { isZipBuffer, matrixToCsv, xlsxBufferToMatrix } from '@/lib/spreadsheet-io';

/**
 * @param payloadBase64 arquivo completo em base64
 * @param filename nome original (para detectar extensão)
 */
export async function importSpreadsheetAction(payloadBase64: string, filename?: string) {
  try {
    if (!payloadBase64 || typeof payloadBase64 !== 'string') {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        skipReasons: [],
        message: 'Arquivo vazio.',
      };
    }

    // data-url ou base64 puro
    const raw = payloadBase64.includes(',')
      ? payloadBase64.split(',').pop()!
      : payloadBase64;
    const buf = Buffer.from(raw, 'base64');
    const name = (filename || '').toLowerCase();

    let csvText = '';

    if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || isZipBuffer(buf)) {
      try {
        const matrix = await xlsxBufferToMatrix(buf);
        if (!matrix.length) {
          return {
            success: false,
            imported: 0,
            skipped: 0,
            skipReasons: [],
            message: 'XLSX sem linhas legíveis na primeira aba.',
          };
        }
        csvText = matrixToCsv(matrix);
      } catch (e: any) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          skipReasons: [],
          message:
            e?.message ||
            'Falha ao ler XLSX. Salve como CSV (UTF-8) no Excel e tente de novo.',
        };
      }
    } else {
      // CSV / TXT / XLS XML exportado como texto
      csvText = buf.toString('utf-8');
      // remove BOM
      if (csvText.charCodeAt(0) === 0xfeff) csvText = csvText.slice(1);
    }

    if (!csvText.trim()) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        skipReasons: [],
        message: 'Conteúdo vazio após leitura do arquivo.',
      };
    }

    // Reutiliza motor atual — sem quebrar mapeamento
    return await importCsvAction(csvText);
  } catch (e: any) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      skipReasons: [],
      message: e?.message || 'Falha na ingestão da planilha.',
    };
  }
}
