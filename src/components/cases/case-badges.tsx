/**
 * Badges estáveis da carteira — leitura em 2s (Cases + Tarefas)
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { isAtendidoNestaSemana } from "@/lib/atendimento-semana";
import { scoreCasePriority } from "@/lib/case-priority";

type Props = {
  c: LegalCase;
  /** mostra badge de prioridade operacional */
  showPriority?: boolean;
  className?: string;
};

export function CaseBadges({ c, showPriority = false, className }: Props) {
  if (!c) return null;
  const prio = showPriority ? scoreCasePriority(c) : null;
  const ur = (c as any).ultimoRetorno || (c as any).ultimo_retorno;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {prio && prio.band !== "normal" && (
        <Badge
          className={cn(
            "h-5 px-2 rounded-md font-black uppercase text-[8px] border-none",
            prio.band === "ba" && "bg-red-600 text-white animate-pulse",
            prio.band === "encerrado_tribunal" && "bg-slate-800 text-white",
            prio.band === "novidade" && "bg-rose-600 text-white",
            prio.band === "cumprimento" && "bg-amber-500 text-black",
            prio.band === "vencido" && "bg-red-50 text-red-700 border border-red-200",
            prio.band === "hoje" && "bg-orange-100 text-orange-800",
            prio.band === "atencao" && "bg-yellow-100 text-yellow-800",
            prio.band === "sem_retorno" && "bg-zinc-100 text-zinc-700"
          )}
        >
          {prio.label}
        </Badge>
      )}

      {(c as any).indicio_busca_apreensao && (
        <Badge className="h-5 px-2 rounded-md bg-red-600 text-white font-black uppercase text-[8px] animate-pulse">
          <ShieldAlert size={10} className="mr-1 inline" />
          B.A.
          {(c as any).ba_tipo ? ` ${String((c as any).ba_tipo)}` : ""}
        </Badge>
      )}

      {(c as any).datajud_encerrado_tribunal && (
        <Badge className="h-5 px-2 rounded-md bg-slate-800 text-white font-black uppercase text-[8px]">
          Encerrado tribunal
          {(c as any).datajud_encerrado_motivo
            ? ` · ${String((c as any).datajud_encerrado_motivo).slice(0, 24)}`
            : ""}
        </Badge>
      )}

      {!!(
        (c as any).tem_novo_andamento ||
        (c as any).tem_atualizacao_pos_retorno ||
        (c as any).djen_nova_comunicacao
      ) && (
        <Badge
          variant="destructive"
          className="h-5 px-2 rounded-md font-black uppercase text-[8px] animate-pulse"
        >
          Novo andamento
        </Badge>
      )}

      {(c.em_cumprimento_sentenca || (c as any).cumprimento_sentenca) && (
        <Badge className="h-5 px-2 rounded-md bg-amber-500 text-black font-black uppercase text-[8px]">
          Cumprimento
        </Badge>
      )}

      {isAtendidoNestaSemana(ur) && (
        <Badge className="badge-semana h-5 px-2 rounded-md font-black uppercase text-[8px]">
          Atendido semana
        </Badge>
      )}

      {(c as any).ai_engine && (
        <Badge
          variant="outline"
          className="h-5 px-2 rounded-md font-black uppercase text-[7px] border-primary/40 text-primary"
        >
          IA {String((c as any).ai_engine).split(":")[0]}
        </Badge>
      )}
    </div>
  );
}
