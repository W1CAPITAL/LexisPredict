"use client";

import { Loader2 } from "lucide-react";

/**
 * Feedback imediato durante a navegação para /processos.
 * A página continua carregando os dados em seguida; este shell evita tela vazia.
 */
export default function LoadingProcessos() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="w-full p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-64 rounded bg-muted" />
          </div>
          <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-12 rounded-xl border border-border bg-card" />
        <div className="rounded-2xl border border-border overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border/60 bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
