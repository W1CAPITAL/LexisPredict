import { LoaderCircle } from "lucide-react";

/**
 * Fallback de conteúdo, não um segundo aplicativo: o shell e a navegação
 * persistentes permanecem visíveis durante a troca de rota.
 */
export default function PageLoader({ label = "Abrindo…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={label}
      className="min-h-[70vh] w-full bg-background p-4 text-foreground sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-muted" />
          <div className="h-3 w-64 max-w-[65vw] rounded bg-muted/70" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          {label}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border/60 bg-card" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-hidden="true">
        <div className="flex h-11 items-center gap-3 border-b border-border/50 px-4">
          <div className="h-3 w-28 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted/70" />
          <div className="ml-auto h-3 w-16 rounded bg-muted/70" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex h-12 items-center gap-3 border-b border-border/40 px-4 last:border-0">
            <div className="h-3 w-1/4 rounded bg-muted/80" />
            <div className="h-3 w-1/3 rounded bg-muted/60" />
            <div className="ml-auto h-6 w-16 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
