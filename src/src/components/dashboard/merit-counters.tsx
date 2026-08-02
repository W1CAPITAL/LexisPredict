/**
 * Contadores de mérito no Painel (procedente / improcedente / audiência).
 * Drop-in: <MeritCounters cases={cases} />
 */
"use client";

import React, { useMemo } from "react";
import { Gavel, Scale, Calendar } from "lucide-react";
import type { LegalCase } from "@/lib/case-logic";
import { buildDashboardMetrics } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

export function MeritCounters({
  cases,
  className,
}: {
  cases: LegalCase[];
  className?: string;
}) {
  const m = useMemo(() => buildDashboardMetrics(cases), [cases]);

  const items = [
    {
      label: "Procedentes",
      value: m.countProcedente,
      icon: Scale,
      tone: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900",
    },
    {
      label: "Improcedentes",
      value: m.countImprocedente,
      icon: Gavel,
      tone: "text-red-600 bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900",
    },
    {
      label: "Audiências",
      value: m.countAudienciaPosRetorno,
      icon: Calendar,
      tone: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900",
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}>
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            "rounded-xl border p-4 flex items-center justify-between gap-3 min-w-0",
            it.tone
          )}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 truncate">
              {it.label}
            </p>
            <p className="text-2xl font-black tabular-nums tracking-tight">{it.value}</p>
            <p className="text-[9px] font-medium opacity-60 mt-0.5">
              Após classificação do scanner
            </p>
          </div>
          <it.icon className="opacity-50 shrink-0" size={22} />
        </div>
      ))}
    </div>
  );
}
