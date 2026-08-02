"use client";

import React, { useMemo } from "react";
import { Gavel, Scale, Calendar } from "lucide-react";
import type { LegalCase } from "@/lib/case-logic";
import { buildDashboardMetrics } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

/** Obrigatório no Painel (/) e no Dossiê (/report) */
export function MeritCounters({
  cases,
  className,
  title = "Procedentes · Improcedentes · Audiências",
}: {
  cases: LegalCase[];
  className?: string;
  title?: string;
}) {
  const m = useMemo(() => buildDashboardMetrics(cases || []), [cases]);

  const items = [
    {
      label: "Procedentes",
      value: m.countProcedente ?? 0,
      icon: Scale,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
    },
    {
      label: "Improcedentes",
      value: m.countImprocedente ?? 0,
      icon: Gavel,
      tone: "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400",
    },
    {
      label: "Audiências",
      value: m.countAudienciaPosRetorno ?? 0,
      icon: Calendar,
      tone: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400",
    },
  ];

  return (
    <section className={cn("space-y-2 w-full", className)} data-testid="merit-counters">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className={cn(
              "rounded-xl border p-4 flex items-center justify-between gap-3 min-w-0 shadow-sm",
              it.tone
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                {it.label}
              </p>
              <p className="text-3xl font-black tabular-nums tracking-tight">{it.value}</p>
            </div>
            <it.icon className="opacity-40 shrink-0" size={22} />
          </div>
        ))}
      </div>
    </section>
  );
}
