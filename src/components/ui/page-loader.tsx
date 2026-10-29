import { LoaderCircle } from "lucide-react";
/** Fallback compacto; os placeholders têm shimmer CSS de baixo custo. */
export default function PageLoader({ label = "Abrindo…" }: { label?: string }) {
 return <div data-lexis-loading-screen role="status" aria-live="polite" aria-busy="true" aria-label={label} className="min-h-[70vh] w-full bg-background p-4 text-foreground sm:p-7">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><div className="lexis-skeleton h-6 w-48 rounded-lg"/><div className="lexis-skeleton h-3 w-64 max-w-[65vw] rounded"/></div><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin text-primary"/>{label}</div></div>
  <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">{Array.from({length:4}).map((_,i)=><div key={i} className="lexis-skeleton h-20 rounded-xl border border-border/40"/>)}</div>
  <div className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-hidden="true"><div className="flex h-11 items-center gap-3 border-b border-border/50 px-4"><div className="lexis-skeleton h-3 w-28 rounded"/><div className="lexis-skeleton h-3 w-20 rounded"/><div className="lexis-skeleton ml-auto h-3 w-16 rounded"/></div>{Array.from({length:6}).map((_,i)=><div key={i} className="flex h-12 items-center gap-3 border-b border-border/40 px-4 last:border-0"><div className="lexis-skeleton h-3 w-1/4 rounded"/><div className="lexis-skeleton h-3 w-1/3 rounded"/><div className="lexis-skeleton ml-auto h-6 w-16 rounded-full"/></div>)}</div>
 </div>;
}
