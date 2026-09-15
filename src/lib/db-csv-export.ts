/** Exporta tabelas SQLite (sql.js) para CSV / ZIP multi-parte. */

export type SqlJsDb = {
  exec: (sql: string) => { columns: string[]; values: unknown[][] }[];
  close: () => void;
};

const CSV_CHUNK_MAX_BYTES = 80 * 1024 * 1024; // ~80 MB por arquivo CSV
export const ZIP_SPLIT_THRESHOLD = 600 * 1024 * 1024; // 600 MB total → dividir
export const MAX_DB_BROWSER_BYTES = 450 * 1024 * 1024; // ~450 MB .db no browser

function escCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(columns: string[], values: unknown[][]): string {
  const head = columns.map(escCsv).join(",");
  const body = values.map((row) => row.map(escCsv).join(",")).join("\n");
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

export function listTables(db: SqlJsDb): string[] {
  const res = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return (res[0]?.values || []).map((r) => String(r[0]));
}

export function countRows(db: SqlJsDb, table: string): number {
  const t = table.replace(/"/g, '""');
  const res = db.exec(`SELECT COUNT(*) FROM "${t}"`);
  return Number(res[0]?.values?.[0]?.[0] ?? 0);
}

/** Exporta uma tabela em páginas; devolve 1+ strings CSV se a tabela for grande. */
export function exportTableCsvParts(
  db: SqlJsDb,
  table: string,
  pageSize = 5000
): { name: string; content: string }[] {
  const t = table.replace(/"/g, '""');
  const total = countRows(db, table);
  const parts: { name: string; content: string }[] = [];
  let offset = 0;
  let part = 0;
  let bufCols: string[] | null = null;
  let bufRows: unknown[][] = [];
  let bufBytes = 0;

  const flush = () => {
    if (!bufCols || !bufRows.length) return;
    part += 1;
    const suffix = part === 1 && offset >= total ? "" : `_part${part}`;
    parts.push({
      name: `${table}${suffix}.csv`,
      content: rowsToCsv(bufCols, bufRows),
    });
    bufRows = [];
    bufBytes = 0;
  };

  while (offset < total) {
    const res = db.exec(
      `SELECT * FROM "${t}" LIMIT ${pageSize} OFFSET ${offset}`
    );
    if (!res.length) break;
    const cols = res[0].columns;
    const vals = res[0].values;
    if (!bufCols) bufCols = cols;

    for (const row of vals) {
      const line = row.map(escCsv).join(",") + "\n";
      const lineBytes = line.length * 2; // approx UTF-16 in JS strings
      if (bufBytes + lineBytes > CSV_CHUNK_MAX_BYTES && bufRows.length) {
        flush();
        bufCols = cols;
      }
      bufRows.push(row);
      bufBytes += lineBytes;
    }
    offset += vals.length;
    if (!vals.length) break;
  }
  flush();
  if (!parts.length && bufCols) {
    parts.push({ name: `${table}.csv`, content: rowsToCsv(bufCols, []) });
  }
  return parts;
}

export async function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Junta CSVs; se total > 600MB, vários ZIPs (parte1, parte2…). */
export async function downloadCsvsAsZipOrSplit(
  files: { name: string; content: string }[],
  baseName = "db-export"
) {
  const JSZip = (await import("jszip")).default;
  let total = 0;
  for (const f of files) total += f.content.length * 2;

  if (total <= ZIP_SPLIT_THRESHOLD) {
    const zip = new JSZip();
    for (const f of files) zip.file(f.name, f.content);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    await downloadBlob(`${baseName}.zip`, blob);
    return { zips: 1, totalBytes: total };
  }

  // Dividir em vários zips ~ abaixo do limiar
  let zip = new JSZip();
  let zipBytes = 0;
  let idx = 1;
  let count = 0;

  const flushZip = async () => {
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    await downloadBlob(`${baseName}-parte${idx}.zip`, blob);
    idx += 1;
    count += 1;
    zip = new JSZip();
    zipBytes = 0;
  };

  for (const f of files) {
    const size = f.content.length * 2;
    if (zipBytes + size > ZIP_SPLIT_THRESHOLD && zipBytes > 0) {
      await flushZip();
    }
    zip.file(f.name, f.content);
    zipBytes += size;
  }
  if (zipBytes > 0) await flushZip();
  return { zips: count, totalBytes: total };
}
