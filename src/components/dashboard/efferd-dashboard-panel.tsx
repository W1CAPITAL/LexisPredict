"use client";

/**
 * Painel KPI Efferd — LazyMotion (bundle menor) + Recharts.
 */
import React, { useMemo } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
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
  default: "",
  danger: "border-red-500/40 bg-red-500/5",
  ok: "border-emerald-500/40 bg-emerald-500/5",
  warn: "border-amber-500/40 bg-amber-500/5",
};

function KpiCard({ k, delay }: { k: Kpi; delay: number }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "orbit-kpi p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm",
        toneCls[k.tone || "default"]
      )}
    >
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
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {k.icon}
        </div>
      </div>
    </m.div>
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
  compact?: boolean;
};

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
  const series = useMemo(() => {
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
    return days.map((d, i) => {
      const wave = 0.55 + ((i * 17) % 10) / 20;
      return {
        day: d,
        scans: Math.max(1, Math.round((novidades || 1) * wave + (i % 3))),
        retornos: Math.max(
          0,
          Math.round((pendentes || 1) * (0.25 + (i % 5) * 0.08))
        ),
      };
    });
  }, [novidades, pendentes]);

  const bars = useMemo(
    () => [
      { name: "Carteira", v: totalProcessos },
      { name: "Ativos", v: ativos ?? totalProcessos },
      { name: "Novidades", v: novidades },
      { name: "Vencidos", v: vencidos },
      { name: "Baixas", v: baixas },
      { name: "Hoje", v: hoje },
    ],
    [totalProcessos, ativos, novidades, vencidos, baixas, hoje]
  );

  const kpis: Kpi[] = [
    {
      label: "Carteira",
      value: totalProcessos,
      icon: <Briefcase size={18} />,
      hint: "Processos na empresa",
    },
    {
      label: "Pendentes / sinal",
      value: pendentes,
      icon: <Activity size={18} />,
      tone: pendentes > 0 ? "warn" : "ok",
    },
    {
      label: "Vencidos",
      value: vencidos,
      icon: <AlertTriangle size={18} />,
      tone: vencidos > 0 ? "danger" : "ok",
    },
    {
      label: "Novidades",
      value: novidades,
      icon: <TrendingUp size={18} />,
      tone: novidades > 0 ? "warn" : "default",
    },
    {
      label: "É hoje",
      value: hoje,
      icon: <Clock size={18} />,
    },
    {
      label: "Baixas CNJ",
      value: baixas,
      icon: <Gavel size={18} />,
      tone: "ok",
    },
  ];

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={cn("space-y-6", className)}>
        <div
          className={cn(
            "grid gap-3",
            compact
              ? "grid-cols-2 md:grid-cols-3"
              : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
          )}
        >
          {kpis.map((k, i) => (
            <KpiCard key={k.label} k={k} delay={i} />
          ))}
        </div>

        {!compact && (
          <div className="grid gap-4 lg:grid-cols-2">
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border/60 bg-card/80 p-4 h-[260px]"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                Fluxo semanal (modelo)
              </p>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="scans"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="retornos"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground) / 0.1)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="rounded-2xl border border-border/60 bg-card/80 p-4 h-[260px]"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Distribuição
                </p>
                {typeof riskScore === "number" ? (
                  <span className="text-xs font-black tabular-nums text-primary">
                    Risco {riskScore}%
                  </span>
                ) : null}
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="v" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </m.div>
          </div>
        )}
      </div>
    </LazyMotion>
  );
}

export default Dashboard;
