"use client";

import React from "react";
import type { LegalCase } from "@/lib/case-logic";
import { linhaDonoAto, linhaFase } from "@/lib/fase-resumo";

export function DonoAtoLine({ c, className }: { c?: LegalCase | null; className?: string }) {
  if (!c) return null;
  return (
    <div className={className}>
      <p className="text-[11px] text-foreground/80 font-medium leading-snug line-clamp-2">{linhaFase(c)}</p>
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{linhaDonoAto(c)}</p>
    </div>
  );
}
