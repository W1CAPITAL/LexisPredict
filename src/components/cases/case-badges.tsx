/**
 * No máximo 1–2 chips (status principal + opcional semana/BA).
 * O detalhe fica no resumo em linguagem simples, não em bandeirinhas.
 */
"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { isAtendidoNestaSemana } from "@/lib/atendimento-semana";
import { getStatusChip, chipClass } from "@/lib/case-status-chip";
import { CaseResumoChip } from "@/components/cases/case-resumo-chip";

type Props = {
  c: LegalCase;
  showPriority?: boolean;
  className?: string;
};

export function CaseBadges({ c, className }: Props) {
  if (!c) return null;
  const chip = getStatusChip(c);
  const semana = isAtendidoNestaSemana(
    (c as any).ultimoRetorno || (c as any).ultimo_retorno
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <CaseResumoChip caseData={c} />
      {semana && chip.tone !== "danger" && (
        <Badge
          variant="outline"
          className="h-5 px-2 rounded-md text-[8px] font-bold uppercase border-emerald-600/40 text-emerald-700"
        >
          Atendido semana
        </Badge>
      )}
    </div>
  );
}
