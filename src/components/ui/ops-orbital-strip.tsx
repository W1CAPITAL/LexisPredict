"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Gavel, Clock, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

type Node = {
  id: string;
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: string;
};

/** Orbital compacto (CSS) — sem motion — para Processos/Tarefas */
export function OpsOrbitalStrip({
  nodes,
  className,
}: {
  nodes: Node[];
  className?: string;
}) {
  if (!nodes?.length) return null;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-4", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 animate-[spin_24s_linear_infinite]" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 animate-[spin_16s_linear_infinite_reverse]" />
      </div>
      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {nodes.map((n) => (
          <div
            key={n.id}
            className="rounded-xl border bg-background/70 px-3 py-2 flex items-center gap-2 shadow-sm"
          >
            <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary", n.tone)}>
              {n.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase text-muted-foreground truncate">{n.label}</p>
              <p className="text-lg font-black tabular-nums leading-none">{n.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function defaultOpsNodes(m: {
  total?: number;
  pendentes?: number;
  vencidos?: number;
  novidades?: number;
  ok?: number;
}): Node[] {
  return [
    { id: "t", label: "Carteira", value: m.total ?? 0, icon: <Gavel size={16} /> },
    { id: "p", label: "Pendentes", value: m.pendentes ?? 0, icon: <Clock size={16} /> },
    { id: "v", label: "Vencidos", value: m.vencidos ?? 0, icon: <AlertTriangle size={16} /> },
    { id: "n", label: "Novidades", value: m.novidades ?? 0, icon: <Activity size={16} /> },
    { id: "o", label: "No prazo", value: m.ok ?? 0, icon: <CheckCircle2 size={16} /> },
  ];
}
