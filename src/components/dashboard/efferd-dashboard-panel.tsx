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
    <div className={cn("rounded-2xl border p-4 shadow-sm backdrop-blur-sm", toneCls[k.tone || "default"])}>
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
  totalProcessos: number;
  ativos?: number;
  pendentes: number;
  vencidos: number;
  novidades: number;
  baixas?: number;
  hoje?: number;
  riskScore?: number;
  className?: string;
  /** Esconde header (quando embutido no painel) */
  compact?: boolean;
};

/**
 * Painel visual estilo Efferd — SEMPRE receber métricas reais do / (page.tsx).
 */
export function Dashboard({
  totalProcessos,
  ativos,
  pendentes,
  vencidos,
  novidades,
  baixas = 0,
  hoje = 0,
  riskScore,
  className,
  compact = false,
}: LexisDashboardProps) {
  const base = Math.max(1, totalProcessos);
  const series = useMemo(() => {
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
    return days.map((d, i) => {
      const wave = 0.55 + ((i * 17) % 10) / 20;
      return {
        day: d,
        scans: Math.max(1, Math.round(novidades * wave + (i % 3))),
        retornos: Math.max(0, Math.round(pendentes * (0.25 + (i % 5) * 0.08))),
      };
    });
  }, [novidades, pendentes]);

  const bars = useMemo(
    () => [
      { name: "Carteira", v: totalProcessos },
      { name: "Ativos", v: ativos ?? totalProcessos },
      { name: "Pendentes", v: pendentes },
      { name: "Novidades", v: novidades },
      { name: "Vencidos", v: vencidos },
      { name: "Baixas", v: baixas },
    ],
    [totalProcessos, ativos, pendentes, novidades, vencidos, baixas]
  );

  const kpis: Kpi[] = [
    {
      label: "Carteira",
      value: totalProcessos,
      hint: "Total de processos",
      icon: <Briefcase size={18} />,
    },
    {
      label: "Ativos",
      value: ativos ?? totalProcessos,
      hint: "Não encerrados",
      icon: <Gavel size={18} />,
      tone: "ok",
    },
    {
      label: "Pendentes / fila",
      value: pendentes,
      hint: "Contato / retorno",
      icon: <Clock size={18} />,
      tone: pendentes > 0 ? "warn" : "ok",
    },
    {
      label: "Novidades",
      value: novidades,
      hint: "DataJud ∪ DJEN",
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
    {
      label: "Hoje",
      value: hoje,
      hint: "Prazo para hoje",
      icon: <Clock size={18} />,
      tone: hoje > 0 ? "warn" : "ok",
    },
  ];

  return (
    <div className={cn("space-y-6", !compact && "p-4 sm:p-6", className)}>
      {!compact && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              LexisPredict · Painel
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <Gavel size={20} className="text-primary" />
              Operação do gabinete
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Métricas reais da carteira · {totalProcessos} processos
              {typeof riskScore === "number" ? ` · risco ${riskScore}%` : ""}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase text-muted-foreground bg-card/80 backdrop-blur">
            <TrendingUp size={14} className="text-emerald-500" />
            Live ops
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border bg-card/80 backdrop-blur p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">
            Scans × retornos (semana · proporcional à carteira)
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
                <YAxis tick={{ fontSize: 11 }} width={32} />
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

        <div className="lg:col-span-2 rounded-2xl border bg-card/80 backdrop-blur p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-3">
            Distribuição real
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11 }} width={32} />
                <Tooltip />
                <Bar dataKey="v" name="Qtd" fill="hsl(221 70% 48%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Base: {base} · baixas {baixas}
          </p>
        </div>
      </div>
    </div>
  );
}
