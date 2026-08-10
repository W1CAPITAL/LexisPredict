"use client";

import React, { useMemo, useState } from "react";
import type { LegalCase } from "@/lib/case-logic";
import { buildBiCompliance } from "@/lib/bi-compliance";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassPanel } from "@/components/ui/glass-panel";
import { OpsKpi } from "@/components/layout/ops-page-chrome";
import { BarChart3, ChevronDown, ShieldCheck } from "lucide-react";

const SEV: Record<string, string> = {
  critical: "bg-red-600 text-white border-transparent",
  warn: "bg-amber-500/90 text-black border-transparent",
  info: "bg-muted text-muted-foreground",
};

/**
 * BI + compliance no visual Cult/shadcn: glass, collapsible, KPIs densos.
 * defaultOpen=false — não rouba a tela do dashboard.
 */
export function BiCompliancePanel({
  cases,
  className,
  defaultOpen = false,
}: {
  cases: LegalCase[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const data = useMemo(() => buildBiCompliance(cases || []), [cases]);
  const critical = data.compliance.filter((c) => c.severity === "critical").length;
  const warns = data.compliance.filter((c) => c.severity === "warn").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <GlassPanel className="overflow-hidden p-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/25 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg border border-border/60 bg-background/80 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">
                  Indicadores e compliance
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Supervisão da carteira · BI operacional
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {critical > 0 && (
                <Badge className="bg-red-600 text-white text-[10px]">
                  {critical} crítico{critical > 1 ? "s" : ""}
                </Badge>
              )}
              {warns > 0 && critical === 0 && (
                <Badge className="bg-amber-500 text-black text-[10px]">
                  {warns} aviso{warns > 1 ? "s" : ""}
                </Badge>
              )}
              <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                {data.kpis[0]?.value ?? 0} ativos
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/40">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.kpis.map((k) => (
                <OpsKpi
                  key={k.id}
                  label={k.label}
                  value={
                    <>
                      {k.value}
                      {k.unit ? (
                        <span className="text-xs font-medium text-muted-foreground ml-1">
                          {k.unit}
                        </span>
                      ) : null}
                    </>
                  }
                  hint={k.hint}
                  tone={k.tone || "neutral"}
                />
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Compliance operacional
                </p>
                <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {data.compliance.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[9px] uppercase", SEV[f.severity])}
                        >
                          {f.severity}
                        </Badge>
                        <span className="font-medium">{f.title}</span>
                        {f.count > 0 && (
                          <span className="text-muted-foreground tabular-nums">
                            ({f.count})
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-1 leading-relaxed">
                        {f.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    Top tribunais
                  </p>
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {data.topTribunais.length === 0 && (
                      <li className="text-xs text-muted-foreground">Sem dados</li>
                    )}
                    {data.topTribunais.map((t) => (
                      <li
                        key={t.name}
                        className="flex justify-between gap-2 text-xs rounded-md px-2 py-1 hover:bg-muted/40"
                      >
                        <span className="truncate font-medium">{t.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {t.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    Top unidades
                  </p>
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {data.topEscritorios.map((t) => (
                      <li
                        key={t.name}
                        className="flex justify-between gap-2 text-xs rounded-md px-2 py-1 hover:bg-muted/40"
                      >
                        <span className="truncate font-medium">{t.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {t.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Indicadores da carteira local. Não substituem BI corporativo nem
              auditoria externa.
            </p>
          </div>
        </CollapsibleContent>
      </GlassPanel>
    </Collapsible>
  );
}
