/**
 * Leitura/escrita de planilhas sem exceljs.
 * - CSV: texto
 * - XLS (SpreadsheetML): Excel abre nativo
 * - XLSX: OOXML mínimo via JSZip (já no package.json)
 */

import JSZip from 'jszip';

export function csvEscape(v: any): string {
  const s = String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${s}"`;
}

export function rowsToCsv(headers: string[], rows: any[][]): string {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  return '\uFEFF' + lines.join('\n');
}

export function toBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

/** SpreadsheetML (.xls) — multi-aba simples */
export function buildSpreadsheetMl(sheets: { name: string; headers: string[]; rows: any[][] }[]): string {
  const esc = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const sheetXml = sheets
    .map((sh) => {
      let rows = `<Row>${sh.headers.map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>\n`;
      for (const r of sh.rows) {
        rows += `<Row>${r
          .map((c) => {
            if (typeof c === 'number' && Number.isFinite(c)) {
              return `<Cell><Data ss:Type="Number">${c}</Data></Cell>`;
            }
            return `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`;
          })
          .join('')}</Row>\n`;
      }
      return `<Worksheet ss:Name="${esc(sh.name)}"><Table>${rows}</Table></Worksheet>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheetXml}
</Workbook>`;
}

/** XLSX mínimo (1 aba) via JSZip */
export async function buildXlsxBase64(headers: string[], rows: any[][]): Promise<string> {
  const zip = new JSZip();
  const escXml = (s: any) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const all = [headers, ...rows];
  let sheetData = '';
  all.forEach((row, rIdx) => {
    const cells = row
      .map((val, cIdx) => {
        const ref = colName(cIdx) + (rIdx + 1);
        const t = typeof val === 'number' && Number.isFinite(val) ? 'n' : 'inlineStr';
        if (t === 'n') {
          return `<c r="${ref}"><v>${val}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${escXml(val)}</t></is></c>`;
      })
      .join('');
    sheetData += `<row r="${rIdx + 1}">${cells}</row>`;
  });

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  zip.folder('xl')?.file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Processos" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  );
  zip.folder('xl')?.folder('_rels')?.file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  );
  zip.folder('xl')?.folder('worksheets')?.file(
    'sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetData}</sheetData>
</worksheet>`
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return Buffer.from(buf).toString('base64');
}

function colName(idx: number): string {
  let n = idx;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Extrai primeira aba de XLSX → matriz de strings (para ingestão).
 * Suporta sharedStrings + inlineStr + números.
 */
export async function xlsxBufferToMatrix(buf: Buffer | ArrayBuffer | Uint8Array): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buf);
  const shared: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('string');
    const re = /<si>\s*(?:<t[^>]*>([^<]*)<\/t>|<r>[\s\S]*?<t[^>]*>([^<]*)<\/t>[\s\S]*?<\/r>)\s*<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ssXml))) {
      shared.push(m[1] ?? m[2] ?? '');
    }
    // fallback mais permissivo
    if (shared.length === 0) {
      const tRe = /<t[^>]*>([^<]*)<\/t>/g;
      while ((m = tRe.exec(ssXml))) shared.push(m[1]);
    }
  }

  const sheetFile =
    zip.file('xl/worksheets/sheet1.xml') ||
    zip.file(Object.keys(zip.files).find((k) => /xl\/worksheets\/sheet\d+\.xml/.test(k)) || '');
  if (!sheetFile) throw new Error('XLSX sem worksheet legível.');

  const sheetXml = await sheetFile.async('string');
  const rows: string[][] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheetXml))) {
    const rowXml = rm[1];
    const cells: { col: number; val: string }[] = [];
    const cRe = /<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(rowXml))) {
      const attrs = cm[1] || cm[3] || '';
      const body = cm[2] || '';
      const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
      const col = ref ? colLettersToIndex(ref[1]) : cells.length;
      let val = '';
      if (/t="s"/.test(attrs)) {
        const v = /<v>(\d+)<\/v>/.exec(body);
        val = v ? shared[Number(v[1])] ?? '' : '';
      } else if (/t="inlineStr"/.test(attrs)) {
        const t = /<t[^>]*>([^<]*)<\/t>/.exec(body);
        val = t ? t[1] : '';
      } else {
        const v = /<v>([^<]*)<\/v>/.exec(body);
        val = v ? v[1] : '';
      }
      cells.push({ col, val });
    }
    cells.sort((a, b) => a.col - b.col);
    const max = cells.reduce((m, c) => Math.max(m, c.col), 0);
    const line = Array(max + 1).fill('');
    cells.forEach((c) => {
      line[c.col] = c.val;
    });
    rows.push(line);
  }
  return rows;
}

function colLettersToIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Matriz → CSV texto (para reutilizar importCsvAction) */
export function matrixToCsv(matrix: string[][]): string {
  if (!matrix.length) return '';
  return rowsToCsv(
    matrix[0].map((h, i) => h || `COL_${i + 1}`),
    matrix.slice(1)
  );
}

/** Detecta se buffer é ZIP/XLSX (PK..) */
export function isZipBuffer(buf: Uint8Array): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}
