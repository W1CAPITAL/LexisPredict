"use client";

import Link from "next/link";
import { PRODUCT, SUITE_PILARES } from "@/lib/product-identity";
import { Scale, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faixa de identidade: reforça "suite jurídica" no Painel.
 * Não altera KPIs nem carga de carteira.
 */
export function SuiteIdentityStrip({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card px-4 py-4 sm:px-6 sm:py-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Scale size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              {PRODUCT.versionLabel}
            </p>
            <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
              {PRODUCT.name}
              <span className="font-semibold text-muted-foreground"> — {PRODUCT.tagline}</span>
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
              {PRODUCT.oneLiner}
            </p>
            <p className="mt-1 text-[10px] font-medium text-muted-foreground/90 max-w-2xl">
              {PRODUCT.notCrm}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SUITE_PILARES.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-foreground">
                {p.title}
              </span>
              <ArrowRight
                size={12}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{p.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
