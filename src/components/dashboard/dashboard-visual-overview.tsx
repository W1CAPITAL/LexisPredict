"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarCheck2,
  ChartNoAxesCombined,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

/**
 * Visual composition based on the supplied charcoal CRM and lavender SaaS
 * dashboard references. Business figures are passed from the existing home
 * screen's authorized Supabase snapshot, never generated in this component.
 */
export type VisualOverviewPoint = { day: string; atendimentos: number };

type Props = {
  total?: number | null;
  ativos?: number | null;
  hoje: number;
  vencidos?: number | null;
  series?: VisualOverviewPoint[] | null;
  loading?: boolean;
};

const integer = (value: number | null | undefined, loading?: boolean) =>
  loading && value == null ? "…" : value == null ? "—" : value.toLocaleString("pt-BR");

export function DashboardVisualOverview({
  total,
  ativos,
  hoje,
  vencidos,
  series,
  loading = false,
}: Props) {
  const chartData = (series || [])
    .filter((entry) => entry.day && Number.isFinite(entry.atendimentos))
    .map((entry) => ({
      day: entry.day,
      atendimentos: Math.max(0, entry.atendimentos),
    }));

  const weeklyTotal = chartData.reduce((sum, item) => sum + item.atendimentos, 0);

  const items = [
    {
      label: "Carteira no escopo",
      value: integer(total, loading),
      detail: "Processos disponíveis",
      href: "/cases",
      Icon: BriefcaseBusiness,
      kind: "total",
    },
    {
      label: "Processos ativos",
      value: integer(ativos, loading),
      detail: "Acompanhar carteira",
      href: "/cases",
      Icon: Activity,
      kind: "active",
    },
    {
      label: "Programados para hoje",
      value: integer(hoje, loading),
      detail: "No lote carregado",
      href: "/tarefas",
      Icon: CalendarCheck2,
      kind: "today",
    },
    {
      label: "Retornos vencidos",
      value: integer(vencidos, loading),
      detail: "Não são prazos judiciais",
      href: "/vencidos",
      Icon: ShieldAlert,
      kind: "overdue",
    },
  ] as const;

  return (
    <section data-lexis-reference-overview aria-label="Panorama executivo da carteira">
      <div className="lx-reference-header">
        <div className="lx-reference-heading">
          <span className="lx-reference-eyebrow">
            <span className="lx-reference-eyebrow-mark" aria-hidden="true" />
            PAINEL OPERACIONAL
          </span>
          <h2>Visão da carteira<span className="lx-reference-heading-dot">.</span></h2>
          <p>Indicadores reais da operação, organizados para decidir o próximo passo.</p>
        </div>
        <Link href="/report" className="lx-reference-report-link">
          Relatórios <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="lx-reference-layout">
        <div className="lx-reference-metrics" aria-label="Indicadores principais">
          {items.map(({ label, value, detail, href, Icon, kind }) => (
            <Link
              key={kind}
              href={href}
              className="lx-reference-metric"
              data-kind={kind}
              aria-label={`${label}: ${value}. ${detail}`}
            >
              <div className="lx-reference-metric-top">
                <span className="lx-reference-metric-label">{label}</span>
                <span className="lx-reference-metric-icon">
                  <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                </span>
              </div>
              <div className="lx-reference-metric-bottom">
                <span className="lx-reference-metric-value" aria-live="off">{value}</span>
                <span className="lx-reference-metric-detail">{detail}</span>
              </div>
              <ArrowUpRight className="lx-reference-metric-arrow" size={14} aria-hidden="true" />
            </Link>
          ))}
        </div>

        <div className="lx-reference-chart-card" aria-label="Atendimentos registrados por dia">
          <div className="lx-reference-chart-header">
            <div>
              <span className="lx-reference-chart-overline">HISTÓRICO DA EQUIPE</span>
              <h3>Ritmo de atendimento</h3>
              <p>Registros disponíveis na semana</p>
            </div>
            <div className="lx-reference-chart-icon" aria-hidden="true">
              <ChartNoAxesCombined size={19} strokeWidth={1.8} />
            </div>
          </div>

          <div className="lx-reference-chart-total">
            {chartData.length ? weeklyTotal.toLocaleString("pt-BR") : "—"}
            <span>atendimentos registrados</span>
          </div>

          <div className="lx-reference-chart-frame">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 9, right: 3, left: 3, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="lx-reference-chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--lx-reference-chart-color)" stopOpacity={0.24} />
                      <stop offset="96%" stopColor="var(--lx-reference-chart-color)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--lx-reference-chart-grid)" strokeDasharray="3 6" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "var(--lx-reference-chart-muted)", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--lx-reference-chart-color)", strokeDasharray: "4 4" }}
                    contentStyle={{
                      borderRadius: 13,
                      background: "var(--lx-reference-tooltip)",
                      border: "1px solid var(--lx-reference-card-border)",
                      boxShadow: "0 12px 28px rgba(12,15,20,.08)",
                      color: "var(--lx-reference-foreground)",
                    }}
                    formatter={(value: number) => [Number(value).toLocaleString("pt-BR"), "Atendimentos"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="atendimentos"
                    name="Atendimentos"
                    stroke="var(--lx-reference-chart-color)"
                    strokeWidth={2.5}
                    fill="url(#lx-reference-chart-fill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "var(--lx-reference-chart-color)" }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="lx-reference-no-chart" role="status">
                {loading ? "Carregando histórico de atendimentos…" : "Ainda não há histórico disponível para este gráfico."}
              </p>
            )}
          </div>
          <Link href="/minhas-atividades" className="lx-reference-chart-footer">
            Ver atividades registradas <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
