"use client";

import { LexisChartTooltip } from "@/components/charts/lexis-chart-tooltip";

/**
 * Painel KPI Efferd — topo do dashboard, cards legíveis + gráficos.
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
  Pencil,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildAtendimentosPorDiaSemana,
  countAtendidosNestaSemana,
  labelSemanaAtual,
} from "@/lib/atendimento-semana";
import {
  countEditadosAppSemana,
  countEditadosAppHoje,
  countAuditadosTribunalSemana,
} from "@/lib/processos-auditados";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "danger" | "ok" | "warn" | "info" | "violet";
};

const toneCls: Record<string, string> = {
  default: "bg-slate-50 border-slate-200/90 dark:bg-slate-900/60 dark:border-slate-700",
  danger: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/60",
  ok: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60",
  warn: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60",
  info: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800/60",
  violet: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800/60",
};

const iconTone: Record<string, string> = {
  default: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  danger: "bg-rose-600 text-white",
  ok: "bg-emerald-600 text-white",
  warn: "bg-amber-500 text-white",
  info: "bg-sky-600 text-white",
  violet: "bg-violet-600 text-white",
};

const BAR_COLORS = [
  "#2563eb",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#60a5fa",
  "#a78bfa",
];

function KpiCard({ k, delay }: { k: Kpi; delay: number }) {
  const tone = k.tone || "default";
  return (
    <m.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 28,
        delay: delay * 0.04,
      }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5 min-h-[118px]",
        "shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]",
        "transition-shadow",
        toneCls[tone]
      )}
    >
      <div className="relative z-10 flex flex-col h-full gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300 leading-tight">
            {k.label}
          </p>
          <div
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              iconTone[tone]
            )}
          >
            {k.icon}
          </div>
        </div>
        <div className="mt-auto">
          <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter text-slate-900 dark:text-white leading-none">
            {k.value}
          </p>
          {k.hint ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 font-medium">
              {k.hint}
            </p>
          ) : null}
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
  /** Casos da carteira — gera série real de último atendimento na semana */
  cases?: Array<{ ultimoRetorno?: string | null; ultimo_retorno?: string | null; auditado_em?: string | null; datajud_consultado_em?: string | null; djen_consultado_em?: string | null; dados?: any }>;
  /** Opcional: se não passar, calcula a partir de cases */
  editadosSemana?: number;
  editadosHoje?: number;
  tribunalSemana?: number;
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
  cases = [],
  editadosSemana,
  editadosHoje,
  tribunalSemana,
}: LexisDashboardProps) {
  const series = useMemo(() => {
    if (cases && cases.length > 0) {
      return buildAtendimentosPorDiaSemana(cases);
    }
    // fallback sem carteira
    const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    return days.map((d) => ({
      day: d,
      scans: 0,
      retornos: 0,
      atendimentos: 0,
      baixas: 0,
    }));
  }, [cases]);

  const atendidosSemana = useMemo(
    () => countAtendidosNestaSemana(cases || []),
    [cases]
  );
  const editadosSemanaN = useMemo(
    () => (editadosSemana != null ? editadosSemana : countEditadosAppSemana(cases || [])),
    [cases, editadosSemana]
  );
  const editadosHojeN = useMemo(
    () => (editadosHoje != null ? editadosHoje : countEditadosAppHoje(cases || [])),
    [cases, editadosHoje]
  );
  const tribunalSemanaN = useMemo(
    () => (tribunalSemana != null ? tribunalSemana : countAuditadosTribunalSemana(cases || [])),
    [cases, tribunalSemana]
  );
  const semanaLabel = useMemo(() => labelSemanaAtual(), []);

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
      icon: <Briefcase size={16} />,
      tone: "info",
      hint: "Total na empresa",
    },
    {
      label: "Pendentes",
      value: pendentes,
      icon: <Activity size={16} />,
      tone: pendentes > 0 ? "warn" : "ok",
      hint: "Andamentos + prazos do dia",
    },
    {
      label: "Vencidos",
      value: vencidos,
      icon: <AlertTriangle size={16} />,
      tone: vencidos > 0 ? "danger" : "ok",
      hint: "Prazo estourado",
    },
    {
      label: "Novidades CNJ",
      value: novidades,
      icon: <TrendingUp size={16} />,
      tone: novidades > 0 ? "warn" : "default",
      hint: "Movimento após retorno",
    },,
    {
      label: "Atend. semana",
      value: atendidosSemana,
      icon: <Clock size={16} />,
      tone: atendidosSemana > 0 ? "ok" : "default",
      hint: semanaLabel,
    },
    {
      label: "Editados app",
      value: editadosSemanaN,
      icon: <Pencil size={16} />,
      tone: "violet",
      hint: "Qualquer salvamento no app · " + semanaLabel,
    },
    {
      label: "Editados hoje",
      value: editadosHojeN,
      icon: <Pencil size={16} />,
      tone: editadosHojeN > 0 ? "info" : "default",
      hint: "Edições de hoje (Brasília)",
    },
    {
      label: "Tribunal sem.",
      value: tribunalSemanaN,
      icon: <Search size={16} />,
      tone: "info",
      hint: "Só DataJud / DJEN (separado)",
    }
    {
      label: "É hoje",
      value: hoje,
      icon: <Clock size={16} />,
      tone: hoje > 0 ? "warn" : "default",
      hint: "Retorno / prazo hoje",
    },
    {
      label: "Baixas tribunal",
      value: baixas,
      icon: <Gavel size={16} />,
      tone: "ok",
      hint: "Encerrados no CNJ",
    },
    {
      label: "Atend. semana",
      value: atendidosSemana,
      icon: <Clock size={16} />,
      tone: atendidosSemana > 0 ? "violet" : "default",
      hint: "Último retorno nesta semana",
    },
  ];

  const risk = typeof riskScore === "number" ? riskScore : 0;
  const gridCls = compact
    ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
    : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3";

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={cn("space-y-5", className)}>
        {/* Risco */}
        <div className="flex items-center gap-3 px-1">
          <Signal size={14} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Risco
          </span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <m.div
              className={cn(
                "h-full rounded-full",
                risk >= 60 ? "bg-rose-500" : risk >= 35 ? "bg-amber-500" : "bg-emerald-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, risk))}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="text-sm font-black tabular-nums w-12 text-right">{risk}%</span>
        </div>

        <div className={gridCls}>
          {kpis.map((k, i) => (
            <KpiCard key={k.label} k={k} delay={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Últimos atendimentos na semana
            </p>
            <p className="text-[9px] text-muted-foreground mb-3">
              {semanaLabel} · {atendidosSemana} caso(s) com retorno nesta semana (carteira completa da empresa)
            </p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="efferdScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor" }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={36} stroke="hsl(var(--border))" />
                  <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} wrapperStyle={{ outline: "none", zIndex: 50 }} />
                  <Area
                    type="monotone"
                    dataKey="atendimentos"
                    stroke="#2563eb"
                    fill="url(#efferdScans)"
                    strokeWidth={2}
                    name="Atendimentos"
                  />
                  <Area
                    type="monotone"
                    dataKey="retornos"
                    stroke="#34d399"
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name="Retornos (mesmo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Distribuição da carteira
            </p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} interval={0} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} width={40} stroke="hsl(var(--border))" />
                  <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} wrapperStyle={{ outline: "none", zIndex: 50 }} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} name="Qtd">
                    {bars.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}

export default Dashboard;
