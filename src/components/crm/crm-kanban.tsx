"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CrmNegocio } from "@/lib/crm-types";
import { CRM_FUNIL_LABELS, type CrmFunilStatus } from "@/lib/crm-types";
import { stageValueSum } from "@/lib/crm-pipeline";
import { ChevronLeft, ChevronRight, Phone, FileText } from "lucide-react";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STAGE_ORDER: CrmFunilStatus[] = [
  "lead",
  "proposta",
  "contrato",
  "execucao",
  "concluido",
  "inadimplente",
  "cancelado",
];

export function CrmKanban({
  byStatus,
  onMove,
  onSelect,
  busyId,
}: {
  byStatus: Record<string, CrmNegocio[]>;
  onMove: (id: string, status: string) => void;
  onSelect?: (n: CrmNegocio) => void;
  busyId?: string | null;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
      {STAGE_ORDER.map((stage) => {
        const list = byStatus[stage] || [];
        const total = stageValueSum(list);
        return (
          <div
            key={stage}
            className="w-[260px] shrink-0 flex flex-col rounded-xl border border-border bg-muted/20"
          >
            <div className="p-2.5 border-b border-border/60 sticky top-0 bg-card/90 backdrop-blur rounded-t-xl">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black uppercase tracking-wide">
                  {CRM_FUNIL_LABELS[stage]}
                </span>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {list.length}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold tabular-nums mt-0.5">
                {brl(total)}
              </p>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
              {list.map((n) => {
                const idx = STAGE_ORDER.indexOf(stage);
                const prev = idx > 0 ? STAGE_ORDER[idx - 1] : null;
                const next = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "rounded-lg border border-border bg-card p-2.5 shadow-sm hover:border-primary/40 transition-colors",
                      busyId === n.id && "opacity-60"
                    )}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelect?.(n)}
                    >
                      <p className="text-xs font-black leading-tight line-clamp-2">{n.cliente_nome}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                        {n.servico_nome || "Sem serviço"}
                      </p>
                      <p className="text-xs font-black tabular-nums mt-1.5">{brl(Number(n.valor_total) || 0)}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {n.protocolo_cnj ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                            <FileText className="h-2.5 w-2.5" /> CNJ
                          </span>
                        ) : null}
                        {n.cliente_telefone ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                            <Phone className="h-2.5 w-2.5" /> tel
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex gap-1 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-[10px]"
                        disabled={!prev || busyId === n.id}
                        onClick={() => prev && onMove(n.id, prev)}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 flex-1 text-[10px]"
                        disabled={!next || busyId === n.id}
                        onClick={() => next && onMove(n.id, next)}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!list.length ? (
                <p className="text-[10px] text-muted-foreground text-center py-6">Vazio</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
