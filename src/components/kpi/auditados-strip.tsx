"use client";

import React from "react";
import { FileSearch, Gavel, Pencil, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelSemanaAuditoria } from "@/lib/processos-auditados";

type Props = {
  auditadosSemana: number;
  auditadosTribunal?: number;
  editadosApp?: number;
  auditadosHoje?: number;
  className?: string;
  compact?: boolean;
};

function Cell({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border-2 border-black bg-white px-3 py-2.5 shadow-[3px_3px_0_#000] min-w-[120px]",
        accent
      )}
    >
      <div className="flex items-center gap-1.5 text-black/70">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums text-black leading-none">{value}</p>
      {hint ? (
        <p className="text-[8px] font-bold uppercase tracking-wide text-black/45">{hint}</p>
      ) : null}
    </div>
  );
}

/** Faixa visível em Dashboard, Cases, Tarefas, Processos, Supervisão */
export function AuditadosStrip({
  auditadosSemana,
  auditadosTribunal,
  editadosApp,
  auditadosHoje,
  className,
  compact,
}: Props) {
  const semana = labelSemanaAuditoria();
  return (
    <div
      className={cn(
        "w-full rounded-2xl border-2 border-black bg-amber-50/90 p-3 sm:p-4",
        className
      )}
      data-kpi="auditados-semana"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
          Processos auditados · esta semana
        </p>
        <p className="text-[9px] font-bold uppercase text-black/50">{semana}</p>
      </div>
      <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 md:grid-cols-4")}>
        <Cell
          icon={<FileSearch size={14} />}
          label="Auditados esta semana"
          value={auditadosSemana ?? 0}
          hint="Tribunal + edição app"
          accent="bg-amber-100"
        />
        <Cell
          icon={<Gavel size={14} />}
          label="Tribunal (DataJud/DJEN)"
          value={auditadosTribunal ?? 0}
          hint="Só consulta CNJ"
        />
        <Cell
          icon={<Pencil size={14} />}
          label="Editados no app"
          value={editadosApp ?? 0}
          hint="Salvar processo"
        />
        <Cell
          icon={<CalendarClock size={14} />}
          label="Auditados hoje"
          value={auditadosHoje ?? 0}
          hint="Calendário Brasília"
        />
      </div>
    </div>
  );
}
