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


export function exportScanLogCsv(): string {
  const rows = loadScanLog();
  const head = "hora,cnj,motor,ok,detalhe";
  const body = rows.map((r) =>
    [r.ts, r.cnj, r.motor, r.ok ? "ok" : "falha", JSON.stringify(r.detalhe || "")].join(",")
  );
  return [head, ...body].join("\n");
}

export function downloadScanLogCsv() {
  if (typeof window === "undefined") return;
  const blob = new Blob([exportScanLogCsv()], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `scan-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
