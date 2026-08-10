"use client";

import React, { useMemo, useState } from "react";
import type { LegalCase } from "@/lib/case-logic";
import { buildBiCompliance } from "@/lib/bi-compliance";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const TONE: Record<string, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  neutral: "text-foreground",
};

const SEV: Record<string, string> = {
  critical: "bg-red-600 text-white",
  warn: "bg-amber-500 text-black",
  info: "bg-muted text-muted-foreground",
};

/**
 * BI operacional — compacto e recolhível (não toma a tela do dashboard).
 */
export function BiCompliancePanel({
  cases,
  className,
  defaultOpen = false,
}: {
  cases: LegalCase[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const data = useMemo(() => buildBiCompliance(cases || []), [cases]);

  const criticalCount = data.compliance.filter((c) => c.severity === "critical").length;
  const warnCount = data.compliance.filter((c) => c.severity === "warn").length;

  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-card/80 shadow-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">Indicadores e compliance</span>
          <Badge variant="outline" className="text-[10px] font-medium shrink-0">
            BI
          </Badge>
          {criticalCount > 0 && (
            <Badge className="bg-red-600 text-white text-[9px] shrink-0">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </Badge>
          )}
          {warnCount > 0 && criticalCount === 0 && (
            <Badge className="bg-amber-500 text-black text-[9px] shrink-0">
              {warnCount} aviso{warnCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
            {data.kpis[0]?.value ?? 0} ativos
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.kpis.map((k) => (
              <div
                key={k.id}
                className="rounded-lg border border-border/50 bg-background/60 px-3 py-2"
              >
                <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                  {k.label}
                </p>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums mt-0.5",
                    TONE[k.tone || "neutral"]
                  )}
                >
                  {k.value}
                  {k.unit ? (
                    <span className="text-[10px] font-medium text-muted-foreground ml-1">
                      {k.unit}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-2">
                Compliance operacional
              </p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {data.compliance.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-md border border-border/50 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("text-[9px] uppercase", SEV[f.severity])}>
                        {f.severity}
                      </Badge>
                      <span className="font-medium">{f.title}</span>
                      {f.count > 0 && (
                        <span className="text-muted-foreground tabular-nums">({f.count})</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-snug">
                      {f.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                  Top tribunais
                </p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {data.topTribunais.length === 0 && (
                    <li className="text-xs text-muted-foreground">Sem dados</li>
                  )}
                  {data.topTribunais.map((t) => (
                    <li
                      key={t.name}
                      className="flex justify-between text-xs gap-2"
                    >
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="tabular-nums text-muted-foreground">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">
                  Top unidades
                </p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {data.topEscritorios.map((t) => (
                    <li
                      key={t.name}
                      className="flex justify-between text-xs gap-2"
                    >
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="tabular-nums text-muted-foreground">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            Supervisão diária do gabinete — não substitui BI corporativo.
          </p>
        </div>
      )}
    </section>
  );
}
