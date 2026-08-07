/**
 * Bridge SheetJS opcional — SEM import estático de 'xlsx' (evita TS2307 se não instalado).
 * Usa Function + dynamic path para o typecheck não exigir o módulo.
 */

export async function parseWorkbookWithSheetJS(
  data: ArrayBuffer | Uint8Array
): Promise<string[][]> {
  try {
    // evita "Cannot find module 'xlsx'" no tsc
    const modName = 'xlsx';
    const XLSX = await (Function('m', 'return import(m)')(modName) as Promise<any>);
    const wb = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    return aoa.map((row) => row.map((c: any) => String(c ?? '')));
  } catch {
    const { xlsxBufferToMatrix } = await import('./spreadsheet-io');
    const u8 = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    return xlsxBufferToMatrix(Buffer.from(u8));
  }
}

export async function buildXlsxWithSheetJS(
  sheets: { name: string; rows: any[][] }[]
): Promise<Uint8Array> {
  try {
    const modName = 'xlsx';
    const XLSX = await (Function('m', 'return import(m)')(modName) as Promise<any>);
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(out);
  } catch (e: any) {
    throw new Error(
      e?.message ||
        'SheetJS (xlsx) não instalado. Use exportDossieXlsxAction (JSZip) ou: npm i xlsx'
    );
  }
}
