"use client";

import React from "react";
import type { LegalCase } from "@/lib/case-logic";
import { computeOpsLinha } from "@/lib/ops-linha";
import { cn } from "@/lib/utils";

export function OpsCaseLine({
  c,
  className,
}: {
  c?: LegalCase | null;
  className?: string;
}) {
  const o = computeOpsLinha(c);
  return (
    <div className={cn("space-y-0.5 min-w-0", className)}>
      <p className="text-[11px] font-medium text-foreground/85 leading-snug line-clamp-2">
        {o.proximo}
      </p>
      <p className="text-[10px] text-muted-foreground line-clamp-1">{o.dono}</p>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[9px] font-black tabular-nums text-primary">{o.score}</span>
        {o.diasTribunal != null && (
          <span className="text-[9px] text-muted-foreground">tribunal {o.diasTribunal}d</span>
        )}
        {o.tags.map((t) => (
          <span
            key={t}
            className="text-[8px] font-black uppercase tracking-wide text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
