/**
 * Badges de carteira — contraste alto (texto sempre legível).
 */
"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { isAtendidoNestaSemana } from "@/lib/atendimento-semana";
import { scoreCasePriority } from "@/lib/case-priority";
import { isSentencaProcedente, isSentencaImprocedente } from "@/lib/merito-detect";

type Props = {
  c: LegalCase;
  showPriority?: boolean;
  className?: string;
};

/** Sólido: fundo forte + texto branco/preto — nunca pastel sobre branco */
const SOLID: Record<string, string> =
  "h-6 px-2.5 rounded-md font-bold uppercase text-[10px] tracking-wide border-0 shadow-sm";

export function CaseBadges({ c, showPriority = true, className }: Props) {
  if (!c) return null;
  const prio = showPriority ? scoreCasePriority(c) : null;
  const ur = (c as any).ultimoRetorno || (c as any).ultimo_retorno;
  const procedente = (() => {
    try {
      return isSentencaProcedente(c as any);
    } catch {
      return !!(c as any).sentenca_procedente;
    }
  })();
  const improcedente = (() => {
    try {
      return isSentencaImprocedente(c as any);
    } catch {
      return !!(c as any).sentenca_improcedente;
    }
  })();

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {prio && prio.band !== "normal" && (
        <Badge
          className={cn(
            SOLID,
            prio.band === "ba" && "bg-red-600 text-white",
            prio.band === "encerrado_tribunal" && "bg-zinc-900 text-white",
            prio.band === "novidade" && "bg-rose-700 text-white",
            prio.band === "cumprimento" && "bg-amber-600 text-white",
            prio.band === "vencido" && "bg-red-700 text-white",
            prio.band === "hoje" && "bg-blue-700 text-white",
            prio.band === "atencao" && "bg-amber-500 text-black",
            prio.band === "sem_retorno" && "bg-zinc-600 text-white"
          )}
        >
          {prio.band === "encerrado_tribunal"
            ? "Baixa no tribunal"
            : prio.band === "cumprimento"
              ? "Cumprimento em curso"
              : prio.label}
        </Badge>
      )}

      {(c as any).indicio_busca_apreensao && (
        <Badge className={cn(SOLID, "bg-red-600 text-white")}>B.A.</Badge>
      )}

      {(c as any).datajud_encerrado_tribunal && prio?.band !== "encerrado_tribunal" && (
        <Badge className={cn(SOLID, "bg-zinc-900 text-white")}>Baixa no tribunal</Badge>
      )}

      {!!(
        (c as any).tem_novo_andamento ||
        (c as any).tem_atualizacao_pos_retorno ||
        (c as any).djen_nova_comunicacao
      ) && prio?.band !== "novidade" && (
        <Badge className={cn(SOLID, "bg-rose-700 text-white")}>Novo andamento</Badge>
      )}

      {(c.em_cumprimento_sentenca || (c as any).cumprimento_sentenca) &&
        prio?.band !== "cumprimento" && (
          <Badge className={cn(SOLID, "bg-amber-600 text-white")}>Cumprimento em curso</Badge>
        )}

      {procedente && (
        <Badge className={cn(SOLID, "bg-emerald-700 text-white")}>Procedente</Badge>
      )}
      {improcedente && (
        <Badge className={cn(SOLID, "bg-orange-700 text-white")}>Improcedente</Badge>
      )}

      {isAtendidoNestaSemana(ur) && (
        <Badge className={cn(SOLID, "bg-sky-700 text-white")}>Atendido semana</Badge>
      )}
    </div>
  );
}
