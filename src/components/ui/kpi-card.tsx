"use client";

/**
 * KpiCard — componente unificado para KPIs e metricas.
 * Fase C: mesmo visual em Dashboard, Cases, Agenda, Configuracoes.
 *
 * Regras:
 *  - Label: text-muted-foreground, 11px, bold, uppercase
 *  - Valor: text-foreground, 28px, blackweight, tabular-nums
 *  - Nunca text-white em fundo claro nem text-black em fundo escuro
 *  - Hover: elevacao sutil (translateY -1px)
 *  - Borda: border-border, radius xl
 */

import React from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { label: string; up: boolean };
  color?: "default" | "primary" | "success" | "danger" | "warning";
  className?: string;
}

const colorMap = {
  default: "",
  primary: "border-l-4 border-l-primary",
  success: "border-l-4 border-l-emerald-500",
  danger: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
};

export function KpiCard({
  title,
  value,
  icon,
  trend,
  color = "default",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 transition-all duration-200",
        "hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-[1px]",
        colorMap[color],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
            {title}
          </p>
          <p className="mt-1.5 text-[28px] font-black leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        {icon ? (
          <div className="shrink-0 rounded-lg bg-primary/10 p-2.5 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {trend ? (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              trend.up
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400"
            )}
          >
            {trend.up ? "↑" : "↓"} {trend.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
