'use server';

/**
 * Ingestão com validação de esquema (CSV / XLSX / Google Sheets exportado).
 * Após validar → importCsvAction (motor atual).
 */

import { importCsvAction } from '@/app/actions/import-actions';
import { validateSheetMatrix } from '@/lib/xlsx-schema';
import { isZipBuffer, matrixToCsv, xlsxBufferToMatrix } from '@/lib/spreadsheet-io';

export async function importSpreadsheetAction(payloadBase64: string, filename?: string) {
  try {
    if (!payloadBase64) {
      return { success: false, imported: 0, skipped: 0, skipReasons: [], message: 'Arquivo vazio.' };
    }

    const raw = payloadBase64.includes(',') ? payloadBase64.split(',').pop()! : payloadBase64;
    const buf = Buffer.from(raw, 'base64');
    const name = (filename || '').toLowerCase();

    let matrix: string[][] = [];

    if (name.endsWith('.xlsx') || name.endsWith('.xlsm') || isZipBuffer(buf)) {
      try {
        matrix = await xlsxBufferToMatrix(buf);
      } catch (e: any) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          skipReasons: [],
          message: e?.message || 'XLSX ilegível. No Google Sheets: Arquivo > Fazer download > CSV ou XLSX.',
          schema: null,
        };
      }
    } else {
      let text = buf.toString('utf-8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      // parse simples para validação (csv-parse fica no importCsvAction)
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) {
        return { success: false, imported: 0, skipped: 0, skipReasons: [], message: 'CSV vazio.' };
      }
      const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
      matrix = lines.map((line) => {
        // split tosco suficiente para validar headers; importCsvAction faz parse real
        const cols: string[] = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQ = !inQ;
            continue;
          }
          if (ch === delim && !inQ) {
            cols.push(cur);
            cur = '';
            continue;
          }
          cur += ch;
        }
        cols.push(cur);
        return cols;
      });
    }

    const schema = validateSheetMatrix(matrix);
    if (!schema.ok) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        skipReasons: schema.missingRequired,
        message: schema.message,
        schema,
      };
    }

    const csvText = matrixToCsv(matrix);
    const result = await importCsvAction(csvText);
    return { ...result, schema };
  } catch (e: any) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      skipReasons: [],
      message: e?.message || 'Falha na ingestão.',
    };
  }
}

export async function validateSpreadsheetAction(payloadBase64: string, filename?: string) {
  try {
    const raw = payloadBase64.includes(',') ? payloadBase64.split(',').pop()! : payloadBase64;
    const buf = Buffer.from(raw, 'base64');
    const name = (filename || '').toLowerCase();
    let matrix: string[][] = [];
    if (name.endsWith('.xlsx') || isZipBuffer(buf)) {
      matrix = await xlsxBufferToMatrix(buf);
    } else {
      const text = buf.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      const delim = (lines[0]?.match(/;/g) || []).length > (lines[0]?.match(/,/g) || []).length ? ';' : ',';
      matrix = lines.map((l) => l.split(delim).map((c) => c.replace(/^"|"$/g, '')));
    }
    return { success: true, ...validateSheetMatrix(matrix) };
  } catch (e: any) {
    return { success: false, ok: false, message: e?.message || 'Validação falhou' };
  }
}
