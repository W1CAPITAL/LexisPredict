"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clearScanLog, loadScanLog, type ScanLogRow } from "@/lib/scan-event-log";

export function ScanLogPanel({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<ScanLogRow[]>([]);
  useEffect(() => {
    const pull = () => setRows(loadScanLog());
    pull();
    window.addEventListener("lexis-scan-log", pull);
    return () => window.removeEventListener("lexis-scan-log", pull);
  }, []);
  if (!rows.length) {
    return (
      <p className="text-[10px] text-muted-foreground">
        Sem log de scan neste navegador.
      </p>
    );
  }
  const view = compact ? rows.slice(0, 8) : rows.slice(0, 40);
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Log de scan
        </p>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { clearScanLog(); setRows([]); }}>
          Limpar
        </Button>
      </div>
      <ul className="space-y-1 max-h-48 overflow-y-auto font-mono text-[10px]">
        {view.map((r, i) => (
          <li key={`${r.ts}-${r.cnj}-${i}`} className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{r.ts.slice(11, 19)}</span>
            <span className={r.ok ? "text-emerald-700" : "text-rose-700"}>{r.ok ? "ok" : "falha"}</span>
            <span className="truncate">{r.cnj}</span>
            <span className="text-muted-foreground truncate">{r.motor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
