"use client";

import { LexisChartTooltip } from "@/components/charts/lexis-chart-tooltip";

/**
 * Painel KPI Efferd — topo do dashboard, cards legíveis + gráficos.
 */
import React, { useMemo,useEffect,useState } from "react";
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
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useAtendimentosHistorico } from "@/hooks/use-atendimentos-historico";
import {fetchFastCarteira,type CarteiraSnapshot} from "@/lib/fast-carteira-client";
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
  default: "bg-white border-slate-200 border-l-4 border-l-slate-800 dark:bg-slate-950 dark:border-slate-700 dark:border-l-slate-200",
  danger: "bg-white border-slate-200 border-l-4 border-l-rose-600 dark:bg-slate-950 dark:border-slate-700 dark:border-l-rose-500",
  ok: "bg-white border-slate-200 border-l-4 border-l-emerald-600 dark:bg-slate-950 dark:border-slate-700 dark:border-l-emerald-500",
  warn: "bg-white border-slate-200 border-l-4 border-l-amber-500 dark:bg-slate-950 dark:border-slate-700 dark:border-l-amber-400",
  info: "bg-white border-slate-200 border-l-4 border-l-sky-600 dark:bg-slate-950 dark:border-slate-700 dark:border-l-sky-400",
  violet: "bg-white border-slate-200 border-l-4 border-l-violet-600 dark:bg-slate-950 dark:border-slate-700 dark:border-l-violet-400",
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
      data-efferd-kpi
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-5 min-h-[118px]",
        "shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.1)]",
        "transition-shadow",
        toneCls[tone]
      )}
    >
      <div className="relative z-10 flex flex-col h-full gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground leading-tight" data-efferd-label>
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
          <p className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter text-foreground leading-none" data-efferd-value>
            {k.value}
          </p>
          {k.hint ? (
            <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 font-medium">
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
  /** Encerrados operacionais (status ENCERRADO na carteira). */
  encerradosCarteira?: number;
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
  encerradosCarteira = 0,
  hoje = 0,
  riskScore,
  className,
  compact = false,
  cases = [],
  editadosSemana,
  editadosHoje,
  tribunalSemana,
}: LexisDashboardProps) {
  const {profile}=useAuth();
  const [empresaResumo,setEmpresaResumo]=useState<CarteiraSnapshot|null>(null);
  const empresaId=String((profile as any)?.empresa_id||"");
  useEffect(()=>{
    if(!empresaId)return;
    let alive=true;
    const carregar=()=>{
      void fetchFastCarteira("empresa",1,0).then(res=>{if(alive)setEmpresaResumo(res.summary);})
       .catch(err=>console.warn("[efferd] resumo da empresa",err));
    };
    carregar();
    const onFocus=()=>{if(!document.hidden)carregar();};
    window.addEventListener("focus",onFocus);
    window.addEventListener("lexis-carteira-updated",carregar);
    const timer=window.setInterval(()=>{if(!document.hidden)carregar();},90_000);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener("focus",onFocus);window.removeEventListener("lexis-carteira-updated",carregar);};
  },[empresaId]);
  const {data:historico,loading:historyLoading,error:historyError}=useAtendimentosHistorico(
    "esta_semana",String((profile as any)?.empresa_id||"")
  );
  // Só o log histórico do Supabase decide atendimento; o array de casos pode
  // estar parcial e ultimo_retorno pode ter sido modificado pelo scanner.
  const series=useMemo(()=>{
    const entries=historico?.dias||[];
    return entries.map(d=>({
      day:d.day,atendimentos:d.atendimentos,retornos:d.atendimentos,scans:0
    }));
  },[historico]);
  const atendidosSemana=historico?.atualizadoEm?historico.processos:null;
  const editadosSemanaN=historico?.edicoes?.processos??null;
  const editadosHojeN=historico?.edicoes?.hoje??null;
  const tribunalSemanaN = useMemo(
    () => (tribunalSemana != null ? tribunalSemana : countAuditadosTribunalSemana(cases || [])),
    [cases, tribunalSemana]
  );
  const semanaLabel = useMemo(() => labelSemanaAtual(), []);

  const bars=useMemo(()=>empresaResumo?[
    {name:"Carteira",v:empresaResumo.total},
    {name:"Ativos",v:empresaResumo.ativos},
    {name:"Novidades",v:empresaResumo.novidades},
    {name:"Vencidos",v:empresaResumo.vencidos},
    {name:"Baixas tribunal",v:empresaResumo.baixas},
    {name:"Enc. carteira",v:empresaResumo.encerrados},
  ]:[],[empresaResumo]);

  const kpis: Kpi[] = [
    {
      label: "Carteira empresa",
      value: empresaResumo?.total ?? "…",
      icon: <Briefcase size={16} />,
      tone: "info",
      hint: "Total consultado no Supabase, empresa inteira",
    },
    {
      label: "Pendentes",
      value: pendentes,
      icon: <Activity size={16} />,
      tone: pendentes > 0 ? "warn" : "ok",
      hint: "Andamentos e prazos do escopo de lista carregado",
    },
    {
      label: "Status vencido no CRM",
      value: empresaResumo?.vencidos ?? "…",
      icon: <AlertTriangle size={16} />,
      tone: (empresaResumo?.vencidos||0)>0 ? "warn" : "ok",
      hint: "Marcações cadastradas; NÃO significa prazo judicial perdido. Veja /vencidos.",
    },
    {
      label: "Novidades CNJ",
      value: empresaResumo?.novidades ?? "…",
      icon: <TrendingUp size={16} />,
      tone: (empresaResumo?.novidades||0)>0 ? "warn" : "default",
      hint: "Movimento após retorno",
    },
    {
      label: "É hoje",
      value: hoje,
      icon: <Clock size={16} />,
      tone: hoje > 0 ? "warn" : "default",
      hint: "Retornos e prazos na lista atualmente carregada",
    },
    {
      label: "Baixas tribunal",
      value: empresaResumo?.baixas ?? "…",
      icon: <Gavel size={16} />,
      tone: (empresaResumo?.baixas||0)>0 ? "ok" : "default",
      hint: "Telemetria tribunal (isBaixaTribunal). Diferente de Enc. carteira.",
    },
    {
      label: "Encerrados carteira",
      value: empresaResumo?.encerrados ?? "…",
      icon: <CheckCircle2 size={16} />,
      tone: (empresaResumo?.encerrados||0)>0 ? "ok" : "default",
      hint: "Marcados ENCERRADO/ARQUIVADO no gabinete",
    },
    {
      label: "Sem retorno há 30+ dias",
      value: empresaResumo?.retornoDisponivel ? (empresaResumo.semRetorno30 ?? 0) : "…",
      icon: <AlertTriangle size={16}/>,
      tone: (empresaResumo?.semRetorno30||0)>0 ? "warn" : "ok",
      hint: "Ativos com último retorno há 30 dias ou mais, incluindo quem nunca teve retorno",
    },
    {
      label: "Nunca teve retorno",
      value: empresaResumo?.retornoDisponivel ? (empresaResumo.semRetornoNunca ?? 0) : "…",
      icon: <Clock size={16}/>,
      tone: (empresaResumo?.semRetornoNunca||0)>0 ? "danger" : "ok",
      hint: "Sem nenhuma data de atendimento registrada no CRM; processos ativos",
    },
    {
      label: "Atendidos sem.",
      value: atendidosSemana ?? "…",
      icon: <Clock size={16} />,
      tone: (atendidosSemana||0)>0 ? "violet" : "default",
      hint: (historyError ? "Não foi possível atualizar: "+historyError : historyLoading && !historico ? "Buscando histórico real..." : "Processos distintos com atendimento registrado") + " · " + semanaLabel,
    },
    {
      label: "Edicoes app",
      value: editadosSemanaN ?? "…",
      icon: <Pencil size={16} />,
      tone: "violet",
      hint: "Processos editados no app, por evento humano autenticado · "+semanaLabel,
    },
    {
      label: "Editados hoje",
      value: editadosHojeN ?? "…",
      icon: <Pencil size={16} />,
      tone: (editadosHojeN||0)>0 ? "info" : "default",
      hint: "Edições de hoje (Brasília)",
    },
    {
      label: "Scanner sem.",
      value: tribunalSemanaN,
      icon: <Search size={16} />,
      tone: "info",
      hint: "Scanner tribunal/diario — separado de atendimento",
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
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Últimos atendimentos na semana
            </p>
            <p className="text-[9px] text-muted-foreground mb-3">
              {semanaLabel} · {atendidosSemana===null?"Carregando":atendidosSemana} processo(s) com atendimento registrado (empresa inteira, inclusive casos de outros responsáveis)
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

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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
