"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { LegalCase } from "@/lib/case-logic";
import {
  matchFiltrosFase,
  type FiltroFaseParado,
} from "@/lib/processos-parados";

export const FASE_CHIPS: { id: FiltroFaseParado; label: string }[] = [
  { id: "sem_contestacao", label: "Sem contestação" },
  { id: "sem_sentenca", label: "Sem sentença" },
  { id: "sem_replica", label: "Sem réplica" },
  { id: "replica_pendente", label: "Réplica pendente" },
  { id: "cumprimento_aberto", label: "Cumprimento aberto" },
];

export function toggleFase(list: FiltroFaseParado[], id: FiltroFaseParado): FiltroFaseParado[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function filtrarPorFase(cases: LegalCase[], filtros: FiltroFaseParado[]): LegalCase[] {
  if (!filtros.length) return cases;
  return cases.filter((c) => matchFiltrosFase(c, filtros));
}

export function FaseFilterBar({
  value,
  onChange,
}: {
  value: FiltroFaseParado[];
  onChange: (next: FiltroFaseParado[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground">Fase</span>
      {FASE_CHIPS.map((chip) => {
        const on = value.includes(chip.id);
        return (
          <Button
            key={chip.id}
            type="button"
            size="sm"
            variant={on ? "default" : "outline"}
            className="h-7 text-[10px] font-bold uppercase"
            onClick={() => onChange(toggleFase(value, chip.id))}
          >
            {chip.label}
          </Button>
        );
      })}
      {value.length > 0 && (
        <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => onChange([])}>
          Limpar
        </Button>
      )}
    </div>
  );
}
