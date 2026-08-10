"use client";

import React, { useMemo } from "react";
import { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";
import { descreverPrazo } from "@/lib/prazos-cpc";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Bloco legível — não usa line-clamp no texto principal.
 * Evita ficar “vazio” por overflow de pai em <p> quebrado.
 */
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
        ? descreverPrazo(
            (caseData as any).proximoPrazo ||
              (caseData as any).proximo_prazo ||
              (caseData as any).proximo_retorno ||
              null
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
        "space-y-1.5 rounded-lg border border-border/70 bg-background/90 px-3 py-2.5 shadow-sm",
        className
      )}
    >
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">
        Em linguagem simples
      </p>
      <p className="text-[13px] font-semibold text-foreground leading-snug">
        {leigo.tituloLeigo || "Atualização no processo"}
      </p>
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        {leigo.detalheLeigo ||
          "Há movimentação registrada. A equipe confere o teor nos autos antes de orientar o cliente."}
      </p>
      {prazo && prazo.tone !== "vazio" && (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium mt-0.5",
            prazo.tone === "vencido" && "border-red-300 text-red-700 bg-red-50",
            prazo.tone === "hoje" && "border-blue-300 text-blue-700 bg-blue-50",
            prazo.tone === "atencao" && "border-amber-300 text-amber-900 bg-amber-50",
            prazo.tone === "ok" && "border-emerald-300 text-emerald-800 bg-emerald-50"
          )}
        >
          {prazo.label}
        </Badge>
      )}
      {atividades.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {atividades.map((a) => (
            <li
              key={a.tipo}
              className="text-[11px] text-muted-foreground flex items-start gap-2"
            >
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
              <span>{a.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
