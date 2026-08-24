"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { descreverPrazoForense } from "@/lib/calendario-tj";

/**
 * Badge de prazo em dias úteis (CPC) — contraste alto.
 * Lote 4.
 */
export function PrazoCpcBadge({
  caseData,
  className,
}: {
  caseData: LegalCase | null | undefined;
  className?: string;
}) {
  const prazo = useMemo(() => {
    if (!caseData) return null;
    const raw =
      (caseData as any).proximoPrazo ||
      (caseData as any).proximo_prazo ||
      (caseData as any).proximo_retorno ||
      null;
    return descreverPrazoForense(raw, new Date(), {
      tribunal: caseData.tribunal,
    });
  }, [caseData]);

  if (!prazo || prazo.tone === "vazio") return null;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <Badge
        className={cn(
          "h-6 px-2.5 rounded-md font-bold text-[10px] uppercase tracking-wide border-0 shadow-sm w-fit",
          prazo.tone === "vencido" && "bg-red-700 text-white",
          prazo.tone === "hoje" && "bg-blue-700 text-white",
          prazo.tone === "atencao" && "bg-amber-500 text-black",
          prazo.tone === "ok" && "bg-emerald-700 text-white"
        )}
      >
        {prazo.label}
      </Badge>
      {(prazo as any).recessoAviso ? (
        <p className="text-[10px] text-amber-800 leading-snug">{(prazo as any).recessoAviso}</p>
      ) : null}
    </div>
  );
}
