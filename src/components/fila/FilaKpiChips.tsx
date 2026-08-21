"use client";

import { cn } from "@/lib/utils";

export type FilaFiltroKpi = "all" | "replica" | "silencio" | "ba" | "novidade";

type Props = {
  replicaPendente: number;
  silencio45: number;
  ba?: number;
  novidade?: number;
  active: FilaFiltroKpi;
  onChange: (f: FilaFiltroKpi) => void;
  className?: string;
};

/**
 * Contadores do header viram filtros com 1 clique.
 * Web + mobile: área de toque confortável.
 */
export function FilaKpiChips({
  replicaPendente,
  silencio45,
  ba = 0,
  novidade = 0,
  active,
  onChange,
  className,
}: Props) {
  const chips: Array<{ id: FilaFiltroKpi; label: string; value: number; tone: string }> = [
    { id: "replica", label: "Réplica", value: replicaPendente, tone: "text-amber-700 bg-amber-500/10 border-amber-500/20" },
    { id: "silencio", label: "Silêncio 45d", value: silencio45, tone: "text-slate-700 bg-slate-500/10 border-slate-500/20" },
    { id: "ba", label: "BA", value: ba, tone: "text-red-700 bg-red-500/10 border-red-500/20" },
    { id: "novidade", label: "Novidade", value: novidade, tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="group" aria-label="Filtros rápidos da fila">
      {chips.map((c) => {
        const isOn = active === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(isOn ? "all" : c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all",
              "min-w-[44px] touch-manipulation",
              isOn ? c.tone + " ring-2 ring-primary/40" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={isOn}
            title={isOn ? "Clique para limpar filtro" : `Filtrar: ${c.label}`}
          >
            <span>{c.label}</span>
            <span className="tabular-nums font-black">{c.value}</span>
          </button>
        );
      })}
    </div>
  );
}
