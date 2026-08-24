"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";
import { sugerirAtividades } from "@/lib/atividades-sugeridas";

/**
 * Checklist local por processo (localStorage).
 * Não grava no Supabase — só ajuda o operador no dia.
 * Lote 4.
 */
export function AtividadesChecklist({
  caseData,
  className,
}: {
  caseData: LegalCase;
  className?: string;
}) {
  const base = useMemo(() => sugerirAtividades(caseData), [caseData]);
  const key = `lexis_ativ_${caseData.protocolo || caseData.id || "x"}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* */
    }
  }, [key]);

  const toggle = (tipo: string) => {
    setDone((prev) => {
      const next = { ...prev, [tipo]: !prev[tipo] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* */
      }
      return next;
    });
  };

  if (!base.length) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-2.5 space-y-1.5 shadow-sm",
        className
      )}
    >
      <p className="text-[9px] font-semibold text-muted-foreground tracking-wide">
        Proximos passos
      </p>
      <ul className="space-y-1">
        {base.map((a) => {
          const isDone = !!done[a.tipo];
          return (
            <li key={a.tipo}>
              <button
                type="button"
                onClick={() => toggle(a.tipo)}
                className={cn(
                  "w-full flex items-start gap-2 text-left rounded-md px-1.5 py-1 text-[11px] transition-colors",
                  isDone
                    ? "text-muted-foreground line-through bg-muted/40"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isDone
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-border bg-background"
                  )}
                >
                  {isDone ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                <span className="leading-snug">{a.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
