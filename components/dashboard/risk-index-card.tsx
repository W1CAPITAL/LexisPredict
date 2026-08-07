"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Info, ChevronDown, ChevronUp } from "lucide-react";
import type { RiskExplanation } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

export function RiskIndexCard({ risk }: { risk: RiskExplanation }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert size={16} className={risk.color} />
          Índice de Risco Global
        </CardTitle>
        <Badge className={cn("font-black text-[10px]", risk.color)} variant="outline">
          {risk.score}/100 · {risk.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-muted-foreground leading-relaxed">{risk.summary}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[10px] font-black uppercase"
          onClick={() => setOpen((v) => !v)}
        >
          <Info size={12} className="mr-1" />
          {open ? "Ocultar detalhe" : "O que significa?"}
          {open ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />}
        </Button>
        {open && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="text-[11px] leading-relaxed">
              <strong>Significado:</strong> pressão operacional média da carteira ativa (fila de
              retornos + sinais críticos). <strong>Não</strong> é probabilidade de ganhar/perder a
              causa.
            </p>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{risk.formula}</p>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider">Drivers (count × peso)</p>
              {risk.factors
                .filter((f) => f.count > 0)
                .sort((a, b) => b.contribution - a.contribution)
                .map((f) => (
                  <div key={f.id} className="flex justify-between gap-2 border-b border-border/40 py-1">
                    <div>
                      <div className="font-semibold">
                        {f.label}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({f.count} × {f.weight})
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{f.meaning}</div>
                    </div>
                    <div className="font-mono text-[10px] shrink-0">+{f.contribution.toFixed(2)}</div>
                  </div>
                ))}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-1">Recomendações</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                {risk.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
