/**
 * Bridge SheetJS (xlsx) — opcional.
 * Se a lib não estiver instalada, cai no parser JSZip interno (spreadsheet-io).
 *
 * npm i xlsx
 */

export async function parseWorkbookWithSheetJS(
  data: ArrayBuffer | Uint8Array
): Promise<string[][]> {
  try {
    // dynamic import — não quebra build se xlsx não existir no typecheck edge
    const XLSX = await import('xlsx');
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    return aoa.map((row) => row.map((c) => String(c ?? '')));
  } catch (e: any) {
    // fallback
    const { xlsxBufferToMatrix } = await import('./spreadsheet-io');
    return xlsxBufferToMatrix(Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data));
  }
}

export async function buildXlsxWithSheetJS(
  sheets: { name: string; rows: any[][] }[]
): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
