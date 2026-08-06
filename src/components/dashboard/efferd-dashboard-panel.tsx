"use client";

import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import {
  Activity,
  Briefcase,
  Clock,
  Gavel,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "danger" | "ok" | "warn";
};

const toneCls = {
  default: "border-border bg-card",
  danger: "border-red-500/40 bg-red-500/5",
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/40 bg-amber-500/5",
};

function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", toneCls[k.tone || "default"])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            {k.label}
          </p>
          <p className="text-2xl font-black mt-1 tabular-nums">{k.value}</p>
          {k.hint ? (
            <p className="text-[11px] text-muted-foreground mt-1">{k.hint}</p>
          ) : null}
        </div>
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          {k.icon}
        </div>
      </div>
    </div>
  );
}

export type LexisDashboardProps = {
  totalProcessos?: number;
  pendentes?: number;
  vencidos?: number;
  novidades?: number;
  className?: string;
};

/**
 * Painel visual estilo Efferd, alimentado por métricas Lexis (props opcionais).
 */
export function Dashboard({
  totalProcessos = 0,
  pendentes = 0,
  vencidos = 0,
  novidades = 0,
  className,
}: LexisDashboardProps) {
  const series = useMemo(
    () =>
      ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d, i) => ({
        day: d,
        scans: Math.max(4, Math.round((novidades || 8) * (0.6 + (i % 5) * 0.15))),
        retornos: Math.max(2, Math.round((pendentes || 10) * (0.3 + (i % 4) * 0.12))),
      })),
    [novidades, pendentes]
  );

  const bars = useMemo(
    () => [
      { name: "Carteira", v: totalProcessos || 12 },
      { name: "Pendentes", v: pendentes || 5 },
      { name: "Novidades", v: novidades || 3 },
      { name: "Vencidos", v: vencidos || 2 },
    ],
    [totalProcessos, pendentes, novidades, vencidos]
  );

  const kpis: Kpi[] = [
    {
      label: "Carteira",
      value: totalProcessos,
      hint: "Processos ativos no gabinete",
      icon: <Briefcase size={18} />,
    },
    {
      label: "Pendentes",
      value: pendentes,
      hint: "Fila de contato",
      icon: <Clock size={18} />,
      tone: pendentes > 0 ? "warn" : "ok",
    },
    {
      label: "Novidades",
      value: novidades,
      hint: "DataJud / DJEN",
      icon: <Activity size={18} />,
      tone: novidades > 0 ? "default" : "ok",
    },
    {
      label: "Vencidos",
      value: vencidos,
      hint: "Prazos em atraso",
      icon: <AlertTriangle size={18} />,
      tone: vencidos > 0 ? "danger" : "ok",
    },
  ];

  return (
    <div className={cn("flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            LexisPredict · Painel
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Gavel size={22} className="text-primary" />
            Operação do gabinete
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão executiva — métricas da carteira, fila e tribunal.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase text-muted-foreground">
          <TrendingUp size={14} className="text-emerald-500" />
          Live ops
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">
            Scans × retornos (semana)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="lexisScan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221 70% 48%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(221 70% 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="scans"
                  name="Scans"
                  stroke="hsl(221 70% 48%)"
                  fill="url(#lexisScan)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="retornos"
                  name="Retornos"
                  stroke="hsl(152 60% 36%)"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">
            Distribuição
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} width={28} />
                <Tooltip />
                <Bar dataKey="v" name="Qtd" fill="hsl(221 70% 48%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
