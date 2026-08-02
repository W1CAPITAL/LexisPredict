/**
 * Aviso honesto sobre limites DataJud / DJEN — reduz suporte e expectativa irreal.
 */
"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function DataJudDisclaimer({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-xl border border-border/80 bg-muted/40 text-muted-foreground",
        compact ? "p-2.5 text-[10px]" : "p-3 text-[11px]",
        className
      )}
      role="note"
    >
      <Info className="shrink-0 mt-0.5 opacity-70" size={compact ? 14 : 16} />
      <p className="leading-relaxed font-medium">
        <span className="font-bold text-foreground/80">DataJud ≠ PJe/e-SAJ.</span> A base
        pública do CNJ pode atrasar, divergir ou não indexar CPF em todos os tribunais.
        DJEN cobre o diário oficial e também pode falhar por rede/geo (403) ou limite de
        taxa. Use para <strong className="text-foreground/80">triagem</strong>; casos
        críticos e prazos fatais exigem conferência no sistema do tribunal.
      </p>
    </div>
  );
}
