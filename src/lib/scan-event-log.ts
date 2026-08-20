export type ScanLogRow = {
  ts: string;
  cnj: string;
  motor: string;
  ok: boolean;
  detalhe?: string;
};

const KEY = "lexis_scan_event_log_v1";
const MAX = 200;

export function loadScanLog(): ScanLogRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function appendScanLog(row: Omit<ScanLogRow, "ts"> & { ts?: string }) {
  if (typeof window === "undefined") return;
  const next: ScanLogRow[] = [
    {
      ts: row.ts || new Date().toISOString(),
      cnj: row.cnj,
      motor: row.motor || "datajud+djen",
      ok: !!row.ok,
      detalhe: row.detalhe,
    },
    ...loadScanLog(),
  ].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("lexis-scan-log"));
  } catch {
    /* quota */
  }
}

export function clearScanLog() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("lexis-scan-log"));
  } catch {
    /* */
  }
}
