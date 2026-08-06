"use client";

/**
 * Painel KPI Efferd — animações fortes (LazyMotion) + gráficos sempre visíveis.
 * compact = menos colunas de KPI; gráficos continuam.
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
  Cell,
} from "recharts";
import {
  Activity,
  Briefcase,
  Clock,
  Gavel,
  TrendingUp,
  AlertTriangle,
  Signal,
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
  default: "border-border/70 bg-card/90",
  danger: "border-red-500/50 bg-red-500/10 shadow-[0_0_24px_rgba(239,68,68,0.12)]",
  ok: "border-emerald-500/45 bg-emerald-500/10",
  warn: "border-amber-500/45 bg-amber-500/10",
};

const BAR_COLORS = [
  "hsl(var(--primary))",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#60a5fa",
  "#a78bfa",
];

function KpiCard({ k, delay }: { k: Kpi; delay: number }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        delay: delay * 0.05,
      }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 backdrop-blur-md",
        "shadow-sm hover:shadow-md transition-shadow",
        toneCls[k.tone || "default"]
      )}
    >
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)),transparent_55%)]" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground truncate">
            {k.label}
          </p>
          <m.p
            className="text-2xl sm:text-3xl font-black mt-1 tabular-nums tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay * 0.05 + 0.15 }}
          >
            {k.value}
          </m.p>
          {k.hint ? (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{k.hint}</p>
          ) : null}
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
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
  /** Só reduz grid de KPI; gráficos permanecem */
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
        baixas: Math.max(0, Math.round((baixas || 0) * (0.1 + (i % 4) * 0.05))),
      };
    });
  }, [novidades, pendentes, baixas]);

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
      hint: "Total na empresa",
    },
    {
      label: "Pendentes / sinal",
      value: pendentes,
      icon: <Activity size={18} />,
      tone: pendentes > 0 ? "warn" : "ok",
      hint: "Andamentos + prazos do dia",
    },
    {
      label: "Vencidos",
      value: vencidos,
      icon: <AlertTriangle size={18} />,
      tone: vencidos > 0 ? "danger" : "ok",
    },
    {
      label: "Novidades CNJ",
      value: novidades,
      icon: <TrendingUp size={18} />,
      tone: novidades > 0 ? "warn" : "default",
    },
    {
      label: "É hoje",
      value: hoje,
      icon: <Clock size={18} />,
      tone: hoje > 0 ? "warn" : "default",
    },
    {
      label: "Baixas tribunal",
      value: baixas,
      icon: <Gavel size={18} />,
      tone: "ok",
    },
  ];

  const risk = typeof riskScore === "number" ? riskScore : 0;

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={cn("space-y-5", className)}>
        {/* Telemetria strip */}
        <m.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
        >
          <Signal size={14} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Telemetria unificada
          </span>
          <span className="text-[11px] font-bold tabular-nums">
            {novidades} novidades · {vencidos} vencidos · {baixas} baixas
          </span>
          <div className="ml-auto flex items-center gap-2 min-w-[120px] max-w-[200px] flex-1">
            <span className="text-[9px] font-black uppercase text-muted-foreground">Risco</span>
            <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
              <m.div
                className={cn(
                  "h-full rounded-full",
                  risk >= 60 ? "bg-red-500" : risk >= 35 ? "bg-amber-500" : "bg-emerald-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, risk)}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-xs font-black tabular-nums">{risk}%</span>
          </div>
        </m.div>

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

        {/* Gráficos — sempre */}
        <div className="grid gap-4 lg:grid-cols-2">
          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="rounded-2xl border border-border/60 bg-card/90 p-4 h-[280px] shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              Fluxo semanal (modelo operacional)
            </p>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="scans"
                  name="Sinais"
                  stroke="hsl(var(--primary))"
                  fill="url(#gScans)"
                  strokeWidth={2.5}
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="retornos"
                  name="Pendências"
                  stroke="hsl(var(--muted-foreground))"
                  fill="transparent"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
            className="rounded-2xl border border-border/60 bg-card/90 p-4 h-[280px] shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
              Distribuição da carteira
            </p>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={bars}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Bar dataKey="v" name="Qtd" radius={[8, 8, 0, 0]} animationDuration={900}>
                  {bars.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </m.div>
        </div>
      </div>
    </LazyMotion>
  );
}

export default Dashboard;
