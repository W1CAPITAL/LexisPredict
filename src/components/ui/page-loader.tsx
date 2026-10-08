import { LexisThinkingOrb } from "@/components/ui/lexis-thinking-orb";

/**
 * Full route fallback: render useful skeleton immediately while Next.js is
 * resolving a navigation. Never leave a blank viewport with a tiny spinner.
 */
export default function PageLoader({ label = "Abrindo…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="relative min-h-screen bg-background text-foreground">
      <div className="fixed inset-x-0 top-0 z-[240] h-[3px] overflow-hidden bg-primary/10">
        <div className="h-full w-1/3 animate-[lexis-route-load_1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <div className="flex min-h-screen animate-pulse">
        <aside className="hidden w-44 shrink-0 space-y-5 border-r border-border/50 bg-muted/30 p-4 md:block" aria-hidden="true">
          <div className="h-10 w-32 rounded-xl bg-muted" />
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-8 rounded-lg bg-muted/70" />)}
        </aside>
        <main className="flex-1 space-y-5 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-7 w-52 rounded-lg bg-muted" />
              <div className="h-3 w-72 max-w-[70vw] rounded bg-muted/80" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 shadow-sm">
              <LexisThinkingOrb state="searching" size={36} aria-label={label} />
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl border border-border/60 bg-card" />)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-36 space-y-3 rounded-2xl border border-border/60 bg-card p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted/70" />
                <div className="h-3 w-5/6 rounded bg-muted/70" />
                <div className="h-6 w-20 rounded-full bg-muted/60" />
              </div>
            ))}
          </div>
        </main>
      </div>
      <style>{`
        @keyframes lexis-route-load {
          0% { transform: translateX(-120%); }
          55% { transform: translateX(160%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
