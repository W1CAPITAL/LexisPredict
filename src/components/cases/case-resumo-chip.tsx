"use client";

import { buildCaseStatusResumo, toneClasses } from "@/lib/case-status-resumo";
import { cn } from "@/lib/utils";

export function CaseResumoChip({ caseData, className }: { caseData: any; className?: string }) {
  const r = buildCaseStatusResumo(caseData);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        toneClasses(r.tone),
        className
      )}
      title={r.label}
    >
      <span className="truncate">{r.label}</span>
    </span>
  );
}
