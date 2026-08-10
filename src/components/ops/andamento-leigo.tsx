"use client";

import React, { useMemo } from "react";
import { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";
import { descreverPrazoForense } from "@/lib/calendario-tj";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function AndamentoLeigoBlock({
  caseData,
  showPrazo = true,
  showAtividades = true,
  className,
}: {
  caseData: LegalCase;
  showPrazo?: boolean;
  showAtividades?: boolean;
  className?: string;
}) {
  const leigo = useMemo(() => traduzirCaso(caseData), [caseData]);
  const prazo = useMemo(
    () =>
      showPrazo
        ? descreverPrazoForense(
            (caseData as any).proximoPrazo ||
              (caseData as any).proximo_prazo ||
              (caseData as any).proximo_retorno ||
              null,
            new Date(),
            { tribunal: caseData.tribunal }
          )
        : null,
    [caseData, showPrazo]
  );
  const atividades = useMemo(
    () => (showAtividades ? sugerirAtividades(caseData) : []),
    [caseData, showAtividades]
  );

  return (
    <div
      className={cn(
        "ops-leigo-block space-y-1.5 rounded-lg border border-border/70 bg-card px-3 py-2.5",
        className
      )}
    >
      <p className="text-[10px] font-medium text-muted-foreground">Em linguagem simples</p>
      <p className="text-sm font-semibold text-foreground leading-snug">
        {leigo.tituloLeigo || "Atualização no processo"}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">{leigo.detalheLeigo}</p>
      {prazo && prazo.tone !== "vazio" && (
        <div className="space-y-1">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-medium",
              prazo.tone === "vencido" && "border-red-300 text-red-700 bg-red-50",
              prazo.tone === "hoje" && "border-blue-300 text-blue-700 bg-blue-50",
              prazo.tone === "atencao" && "border-amber-300 text-amber-900 bg-amber-50",
              prazo.tone === "ok" && "border-emerald-300 text-emerald-800 bg-emerald-50"
            )}
          >
            {prazo.label}
          </Badge>
          {(prazo as any).recessoAviso && (
            <p className="text-[10px] text-amber-800 leading-snug">{(prazo as any).recessoAviso}</p>
          )}
        </div>
      )}
      {atividades.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {atividades.map((a) => (
            <li key={a.tipo} className="text-[11px] text-muted-foreground flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
              {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
