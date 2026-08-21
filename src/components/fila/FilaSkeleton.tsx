"use client";

import { cn } from "@/lib/utils";

/** Skeleton da Fila — evita tela em branco no modo web. */
export function FilaSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-4 animate-in fade-in duration-300", className)} aria-busy aria-label="Carregando fila">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 max-w-[180px] rounded bg-muted/60 animate-pulse" />
              <div className="h-3 w-3/5 max-w-[240px] rounded bg-muted/40 animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded-lg bg-muted/50 animate-pulse hidden sm:block" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-muted/40 animate-pulse" />
            <div className="h-6 w-24 rounded-full bg-muted/30 animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-muted/30 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
