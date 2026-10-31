import { LoaderCircle } from "lucide-react";

/**
 * Suspense fallback shared by the dashboard and heavy list routes.
 * Keeps the persistent sidebar mounted and paints the page silhouette,
 * so a route switch never presents an empty white canvas.
 */
export default function PageLoader({ label = "Abrindo…" }: { label?: string }) {
  return (
    <div
      data-lexis-loading-screen
      data-lexis-page-skeleton
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="w-full text-foreground"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-3" aria-hidden="true">
          <div className="lx-skeleton-block h-7 w-44 max-w-[60vw]" />
          <div className="lx-skeleton-block h-3 w-72 max-w-[72vw]" />
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
          <LoaderCircle className="h-4 w-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
          {label}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="lx-skeleton-frame flex h-28 flex-col justify-between p-4" key={i}>
            <div className="lx-skeleton-block h-3 w-24 max-w-full" />
            <div className="lx-skeleton-block h-7 w-20 max-w-full" />
            <div className="lx-skeleton-block h-2.5 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5" aria-hidden="true">
        <section className="lx-skeleton-frame min-w-0 p-5 xl:col-span-3">
          <div className="flex items-center justify-between gap-5">
            <div className="lx-skeleton-block h-4 w-40" />
            <div className="lx-skeleton-block h-8 w-24 rounded-full" />
          </div>
          <div className="mt-7 flex h-44 items-end gap-3 overflow-hidden sm:h-52">
            {[46, 73, 56, 84, 61, 97, 71, 88, 62, 79].map((h, i) => (
              <div key={i} className="lx-skeleton-block min-w-0 flex-1 rounded-t-xl" style={{ height: h + "%" }} />
            ))}
          </div>
          <div className="mt-4 flex justify-between gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="lx-skeleton-block h-2 w-10" />
            ))}
          </div>
        </section>
        <section className="lx-skeleton-frame min-w-0 p-5 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div className="lx-skeleton-block h-4 w-32" />
            <div className="lx-skeleton-block h-8 w-8 rounded-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="flex items-center gap-3 border-b border-border/40 py-3 last:border-0" key={i}>
              <div className="lx-skeleton-block h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="lx-skeleton-block h-3 w-3/5" />
                <div className="lx-skeleton-block h-2.5 w-4/5" />
              </div>
              <div className="lx-skeleton-block h-5 w-12 rounded-full" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
