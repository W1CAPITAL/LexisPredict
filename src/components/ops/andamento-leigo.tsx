"use client";

import React from "react";
import { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";
import { descreverPrazo } from "@/lib/prazos-cpc";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Bloco compacto: linguagem simples + prazo CPC + mini checklist */
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
  const leigo = traduzirCaso(caseData);
  const prazo = showPrazo
    ? descreverPrazo(
        (caseData as any).proximoPrazo ||
          (caseData as any).proximo_prazo ||
          null
      )
    : null;
  const atividades = showAtividades ? sugerirAtividades(caseData) : [];

  return (
    <div className={cn("space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3", className)}>
      <p className="text-[10px] font-semibold text-muted-foreground">
        Em linguagem simples
      </p>
      <p className="text-sm font-semibold text-foreground leading-snug">
        {leigo.tituloLeigo}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {leigo.detalheLeigo}
      </p>
      {prazo && prazo.tone !== "vazio" && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium",
            prazo.tone === "vencido" && "border-red-300 text-red-700",
            prazo.tone === "hoje" && "border-blue-300 text-blue-700",
            prazo.tone === "atencao" && "border-amber-300 text-amber-800",
            prazo.tone === "ok" && "border-emerald-300 text-emerald-800"
          )}
        >
          {prazo.label}
        </Badge>
      )}
      {atividades.length > 0 && (
        <ul className="mt-1 space-y-1">
          {atividades.map((a) => (
            <li
              key={a.tipo}
              className="text-[11px] text-muted-foreground flex items-center gap-2"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
              {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
