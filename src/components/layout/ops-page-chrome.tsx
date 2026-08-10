"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";

/** Cabeçalho de página operacional (sobrio, denso, sem “cara de template”). */
export function OpsPageHeader({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-md",
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-3.5",
        className
      )}
    >
      <div className="min-w-0 flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 h-9 w-9 rounded-xl border border-border/60 bg-background/80 flex items-center justify-center text-foreground shrink-0">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </header>
  );
}

/** Card de seção com glass leve (Cult texture-card feel via classes existentes). */
export function OpsSection({
  title,
  description,
  action,
  children,
  className,
  glass = true,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}) {
  const Body = glass ? GlassPanel : "div";
  return (
    <Body
      className={cn(
        !glass && "rounded-xl border border-border/60 bg-card shadow-sm",
        "p-4 sm:p-5 space-y-3",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </Body>
  );
}

/** KPI compacto no estilo dashboard Cult/shadcn */
export function OpsKpi({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-700 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-background/70 backdrop-blur-sm px-3 py-2.5 transition-colors hover:border-border">
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">
        {label}
      </p>
      <p className={cn("text-xl font-semibold tabular-nums tracking-tight mt-1", toneCls)}>
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{hint}</p>
      ) : null}
    </div>
  );
}
