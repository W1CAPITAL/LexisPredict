"use client";

import { Focus, List } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
};

/** Alterna lista completa ↔ um card em destaque (bom no desktop e tablet). */
export function FilaFocusToggle({ enabled, onToggle, className }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all touch-manipulation",
        enabled
          ? "bg-primary/15 border-primary/40 text-primary"
          : "bg-secondary/30 border-border/50 text-muted-foreground hover:text-foreground",
        className
      )}
      aria-pressed={enabled}
      title={enabled ? "Sair do modo foco" : "Modo foco — um caso por vez"}
    >
      {enabled ? <Focus size={14} /> : <List size={14} />}
      <span className="hidden sm:inline">{enabled ? "Foco" : "Lista"}</span>
    </button>
  );
}
