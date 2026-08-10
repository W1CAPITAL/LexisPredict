"use client";

/**
 * Versão COMPACTA — uma linha, sem faixa amarela gigante.
 * Preferir KPIs dentro do Efferd no Dashboard.
 */
import React from "react";
import { cn } from "@/lib/utils";
import { labelSemanaAuditoria } from "@/lib/processos-auditados";

type Props = {
  auditadosSemana?: number;
  auditadosTribunal?: number;
  editadosApp?: number;
  auditadosHoje?: number;
  className?: string;
  compact?: boolean;
};

export function AuditadosStrip({
  auditadosSemana = 0,
  auditadosTribunal = 0,
  editadosApp = 0,
  auditadosHoje = 0,
  className,
}: Props) {
  const editados = editadosApp || auditadosSemana;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1 py-1",
        className
      )}
      data-kpi="auditados-compact"
    >
      <span className="text-foreground font-black">Ops {labelSemanaAuditoria()}</span>
      <span>
        Editados app: <strong className="text-foreground tabular-nums">{editados}</strong>
      </span>
      <span>
        Hoje: <strong className="text-foreground tabular-nums">{auditadosHoje}</strong>
      </span>
      <span>
        Tribunal: <strong className="text-foreground tabular-nums">{auditadosTribunal}</strong>
      </span>
    </div>
  );
}
