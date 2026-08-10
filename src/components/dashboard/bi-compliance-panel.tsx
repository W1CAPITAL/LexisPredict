"use client";

import React, { useMemo } from "react";
import type { LegalCase } from "@/lib/case-logic";
import { buildBiCompliance } from "@/lib/bi-compliance";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, BarChart3, AlertTriangle } from "lucide-react";

const TONE: Record<string, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700",
  neutral: "text-foreground",
};

const SEV: Record<string, string> = {
  critical: "bg-red-600 text-white",
  warn: "bg-amber-500 text-black",
  info: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
};

/**
 * Painel BI + compliance operacional — para Dashboard ou Report.
 */
export function BiCompliancePanel({
  cases,
  className,
}: {
  cases: LegalCase[];
  className?: string;
}) {
  const data = useMemo(() => buildBiCompliance(cases || []), [cases]);

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Indicadores e compliance</h3>
        </div>
        <Badge variant="outline" className="text-[10px] font-medium">
          BI operacional
        </Badge>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {data.kpis.map((k) => (
          <div
            key={k.id}
            className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5"
          >
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">
              {k.label}
            </p>
            <p
              className={cn(
                "text-xl font-bold tabular-nums mt-0.5",
                TONE[k.tone || "neutral"]
              )}
            >
              {k.value}
              {k.unit ? (
                <span className="text-xs font-medium text-muted-foreground ml-1">
                  {k.unit}
                </span>
              ) : null}
            </p>
            {k.hint ? (
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                {k.hint}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Compliance operacional
          </p>
          <ul className="space-y-2">
            {data.compliance.map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge className={cn("text-[9px] uppercase", SEV[f.severity])}>
                    {f.severity}
                  </Badge>
                  <span className="font-semibold">{f.title}</span>
                  {f.count > 0 && (
                    <span className="text-muted-foreground tabular-nums">
                      ({f.count})
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {f.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">
              Top tribunais (ativos)
            </p>
            <ul className="space-y-1">
              {data.topTribunais.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-medium truncate pr-2">{t.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))}
              {data.topTribunais.length === 0 && (
                <li className="text-xs text-muted-foreground">Sem dados</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-2">
              Top unidades / escritórios
            </p>
            <ul className="space-y-1">
              {data.topEscritorios.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-medium truncate pr-2">{t.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Indicadores derivados da carteira local. Não substituem BI corporativo nem
        auditoria externa; servem para supervisão diária do gabinete.
      </p>
    </section>
  );
}
