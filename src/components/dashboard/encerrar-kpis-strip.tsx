"use client";

import { useMemo } from "react";
import { computeEncerrarScannerStats } from "@/lib/encerrar-scanner-stats";

export function EncerrarKpisStrip({
  cases,
  authUserId,
}: {
  cases: any[];
  authUserId?: string | null;
}) {
  const s = useMemo(
    () => computeEncerrarScannerStats(cases, { authUserId }),
    [cases, authUserId]
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      {[
        { l: "Seus encerrados", v: s.usuarioEncerrados },
        { l: "Empresa encerrados", v: s.empresaEncerrados },
        { l: "Auto scanner (semana)", v: s.scannerAutoSemana },
        { l: "Auto scanner (total)", v: s.scannerAutoTotal },
      ].map((x) => (
        <div key={x.l} className="rounded-lg border border-border/60 px-3 py-2 bg-card/50">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            {x.l}
          </p>
          <p className="text-xl font-black tabular-nums">{x.v}</p>
        </div>
      ))}
    </div>
  );
}
