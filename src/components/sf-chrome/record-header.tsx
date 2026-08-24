"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  subtitle?: string;
  badges?: { label: string; variant?: "default" | "outline" | "secondary" | "destructive" }[];
  actions?: React.ReactNode;
  className?: string;
};

/** Cabeçalho denso estilo registro Salesforce — só UI. */
export function RecordHeader({ title, subtitle, badges, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        "border-b border-border/60 pb-4 mb-4",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground font-mono truncate">{subtitle}</p>
        ) : null}
        {badges && badges.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {badges.map((b) => (
              <Badge key={b.label} variant={b.variant || "outline"} className="text-[10px] uppercase tracking-wide">
                {b.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
