"use client";

import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";
import { descreverPrazoForense } from "@/lib/calendario-tj";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";

export function AndamentoLeigoBlock({
  caseData,
  showPrazo = false,
  showAtividades = false,
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
        "ops-leigo-block space-y-1 rounded-lg border border-border bg-background px-2.5 py-2 shadow-sm",
        className
      )}
    >
      <p className="text-[9px] font-semibold text-muted-foreground tracking-wide">
        Em linguagem simples
      </p>
      <p className="text-[12px] font-medium text-foreground leading-snug">
        {leigo.tituloLeigo || "Atualizacao no processo"}
      </p>
      {leigo.detalheLeigo && leigo.detalheLeigo !== leigo.tituloLeigo ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
          {leigo.detalheLeigo}
        </p>
      ) : null}
      {prazo && prazo.tone !== "vazio" && (
        <div className="space-y-1">
          <Badge
            className={cn(
              "h-6 px-2.5 rounded-md font-bold text-[10px] uppercase border-0 shadow-sm",
              prazo.tone === "vencido" && "bg-red-700 text-white",
              prazo.tone === "hoje" && "bg-blue-700 text-white",
              prazo.tone === "atencao" && "bg-amber-500 text-black",
              prazo.tone === "ok" && "bg-emerald-700 text-white"
            )}
          >
            {prazo.label}
          </Badge>
          {(prazo as any).recessoAviso && (
            <p className="text-[10px] text-amber-800 leading-snug">
              {(prazo as any).recessoAviso}
            </p>
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
