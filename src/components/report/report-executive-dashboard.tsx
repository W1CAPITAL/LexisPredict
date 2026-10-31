"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, MessageCircle, Users } from "lucide-react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ReportPdfExportButton } from "./report-pdf-export-button";
import { REPORT_COLORS as C, reportPersonColor, reportPriorities, reportValue } from "@/lib/report/visual-report";

type Person = { id: string; nome: string; carteira: number; atendimentos: number; encerramentos: number; edicoes: number; atividades: number | null };
type Props = {
  periodo: "esta_semana" | "semana_passada" | "mes"; meus: boolean; canViewTeam: boolean; canExport: boolean; company?: string;
  total: number | null; ativos: number | null; encerrados: number | null; novidades: number | null; vencidos: number | null;
  semRetorno: number | null; atendidos: number | null; eventos: number | null; meritoPendente: number | null; atividadesRegistradas: number | null;
  equipe: Person[]; dias: Array<{ ymd: string; atendimentos: number; encerramentos: number }>;
};
const periodNames = { esta_semana: "Esta semana", semana_passada: "Semana passada", mes: "Mês atual" };
export function ReportExecutiveDashboard(p: Props) {
  const [selected, setSelected] = useState("todos");
  const [metric, setMetric] = useState<"carteira" | "atendimentos" | "atividades">("atendimentos");
  const people = useMemo(() => [...p.equipe].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [p.equipe]);
  const visible = selected === "todos" ? people : people.filter(x => x.id === selected);
  const max = Math.max(1, ...visible.map(x => x[metric] ?? 0));
  const distribution: Array<{ name: string; value: number | null; color: string }> = [
    { name: "Ativos", value: p.ativos, color: C.blue }, { name: "Encerrados no CRM", value: p.encerrados, color: C.purple },
    { name: "Outras situações", value: p.total != null && p.ativos != null && p.encerrados != null ? Math.max(0, p.total - p.ativos - p.encerrados) : null, color: C.teal },
  ];
  const distributionReady = distribution.every(x => x.value != null);
  const pie = distribution.filter((x): x is { name: string; value: number; color: string } => x.value != null && x.value > 0);
  const path = (periodo: string, meus = p.meus) => "/report?" + new URLSearchParams({ periodo, escopo: meus || !p.canViewTeam ? "meus" : "empresa" });
  const priorities = reportPriorities({ overdue: p.vencidos, news: p.novidades, missing: p.semRetorno });
  const stats = [
    { label: "Carteira atual", value: p.total, note: "Total cadastral da consulta", Icon: BriefcaseBusiness, color: C.blue },
    { label: "Ativos", value: p.ativos, note: "Situação atual no CRM", Icon: Users, color: C.teal },
    { label: "Encerrados no CRM", value: p.encerrados, note: "Situação administrativa", Icon: CheckCircle2, color: C.purple },
    { label: "Processos atendidos", value: p.atendidos, note: "Distintos no período", Icon: MessageCircle, color: C.blue },
    { label: "Eventos de atendimento", value: p.eventos, note: "Registros no período", Icon: Activity, color: C.purple },
    { label: "Atividades cadastradas", value: p.atividadesRegistradas, note: "Histórico completo, todas as datas", Icon: ClipboardList, color: C.teal },
    { label: "Com novidade", value: p.novidades, note: "Sinal atual na carteira", Icon: MessageCircle, color: C.blue },
    { label: "Sem retorno 30d+", value: p.semRetorno, note: "Critério de data na fonte", Icon: CalendarClock, color: C.gold },
    { label: "Mérito a esclarecer", value: p.meritoPendente, note: "Classificação judicial a conferir", Icon: BarChart3, color: C.red },
  ];
  return <section data-report-surface="executive" className="rv-shell" aria-label="Painel executivo de relatórios">
    <header className="rv-hero">
      <div className="rv-hero-orbits" aria-hidden="true" />
      <div className="rv-hero-content">
        <span className="rv-eyebrow">{p.company || "Empresa vinculada"} / Relatórios</span>
        <h1>Equipe, operação<br /><span>e resultados.</span></h1>
        <p>O trabalho do período em uma leitura visual, com os registros de cada pessoa e as prioridades da carteira.</p>
        <div className="rv-pills"><span>{periodNames[p.periodo]}</span><span>{p.meus ? "Minha carteira" : "Empresa inteira"}</span></div>
      </div>
      <div className="rv-glass">
        <CalendarClock size={25} aria-hidden="true" /><span className="rv-glass-value">{reportValue(p.vencidos)}</span>
        <strong>vencidos no CRM</strong><p>{p.vencidos === 0 ? "Nenhum marcado no recorte. SAC e novas mensagens continuam." : "Classificação operacional da carteira. Conferir os registros antes de agir."}</p>
      </div>
    </header>
    <nav className="rv-toolbar" aria-label="Filtros do relatório">
      <div><label>Período dos eventos</label><div className="rv-segments">{Object.entries(periodNames).map(([id, label]) => <Link key={id} href={path(id)} aria-current={p.periodo === id ? "page" : undefined}>{label}</Link>)}</div></div>
      <div><label>Escopo</label><div className="rv-segments">{p.canViewTeam ? <Link href={path(p.periodo, false)} aria-current={!p.meus ? "page" : undefined}>Empresa</Link> : null}<Link href={path(p.periodo, true)} aria-current={p.meus ? "page" : undefined}>Minha carteira</Link></div></div>
      <div className="rv-toolbar-actions"><Link className="rv-button-secondary" href="/analises-internas">Minhas análises</Link>{p.canExport ? <ReportPdfExportButton periodo={p.periodo} escopo={p.meus ? "meus" : "empresa"} className="rv-button-primary" /> : null}</div>
    </nav>
    <div className="rv-stats">{stats.map(k => <article className="rv-card rv-stat" key={k.label}>
      <k.Icon className="rv-stat-icon" size={21} style={{ color: k.color }} aria-hidden="true" /><strong style={{ color: k.color }}>{reportValue(k.value)}</strong><h2>{k.label}</h2><p>{k.note}</p>
    </article>)}</div>
    <div className="rv-charts">
      <article className="rv-card"><div className="rv-section-heading"><h2>Evolução dos atendimentos</h2><span>{periodNames[p.periodo]}</span></div>
        {p.dias.length ? <div className="rv-chart" role="img" aria-label="Atendimentos e encerramentos por dia"><ResponsiveContainer width="100%" height="100%"><LineChart data={p.dias} margin={{ top: 15, right: 16, bottom: 2, left: -20 }}><CartesianGrid stroke="var(--rv-line)" vertical={false} /><XAxis dataKey="ymd" tickFormatter={v => String(v).slice(8, 10) + "/" + String(v).slice(5, 7)} tick={{ fontSize: 10, fill: "var(--rv-muted)" }} minTickGap={20} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--rv-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--rv-card)", color: "var(--rv-ink)", borderColor: "var(--rv-line)", borderRadius: 14 }} labelFormatter={v => String(v).split("-").reverse().join("/")} /><Line isAnimationActive={false} type="linear" dataKey="atendimentos" name="Atendimentos" stroke={C.blue} strokeWidth={3} dot={false} /><Line isAnimationActive={false} type="linear" dataKey="encerramentos" name="Encerramentos manuais" stroke={C.teal} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <p className="rv-empty">Série diária indisponível nesta consulta.</p>}
        <p className="rv-caption">Eventos registrados por dia. Encerramento no CRM não significa êxito judicial.</p>
      </article>
      <article className="rv-card"><div className="rv-section-heading"><h2>Distribuição da carteira</h2><BriefcaseBusiness size={19} /></div>
        {distributionReady && pie.length ? <div className="rv-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={pie} dataKey="value" innerRadius={61} outerRadius={82} stroke="none">{pie.map(x => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip contentStyle={{ background: "var(--rv-card)", borderColor: "var(--rv-line)", borderRadius: 12 }} /></PieChart></ResponsiveContainer><div className="rv-donut-total"><strong>{reportValue(p.total)}</strong><span>processos</span></div></div> : <p className="rv-empty">{p.total === 0 ? "Nenhum processo nesta seleção." : "Distribuição indisponível nesta consulta."}</p>}
        <div className="rv-legend">{distribution.map(x => <div key={x.name}><span><i style={{ background: x.color }} />{x.name}</span><b>{reportValue(x.value)}</b></div>)}</div>
      </article>
    </div>
    <section className="rv-card" id="painel-equipe"><div className="rv-section-heading"><div><span className="rv-eyebrow">Pessoas e registros</span><h2>A equipe, pessoa por pessoa</h2></div><div className="rv-filters"><label>Pessoa<select value={selected} onChange={e => setSelected(e.target.value)}><option value="todos">Toda a equipe</option>{people.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label><label>Comparar<select value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option value="atendimentos">Atendimentos no período</option><option value="carteira">Carteira atual</option><option value="atividades">Atividades no histórico</option></select></label></div></div>
      <div className="rv-people">{visible.map(x => { const color = reportPersonColor(x.id); return <article className="rv-person" key={x.id}><header><span className="rv-avatar" style={{ color, background: color + "18" }}>{x.nome.slice(0, 1)}</span><h3>{x.nome}</h3></header><div className="rv-person-metrics"><div><strong style={{ color }}>{reportValue(x.atendimentos)}</strong><span>atendimentos no período</span></div><div><strong style={{ color }}>{reportValue(x.edicoes)}</strong><span>processos editados</span></div><div><strong style={{ color }}>{reportValue(x.encerramentos)}</strong><span>encerramentos manuais</span></div><div><strong style={{ color }}>{reportValue(x.atividades)}</strong><span>atividades no histórico</span></div></div><div className="rv-meter"><span style={{ width: `${Math.max(0, (x[metric] ?? 0) / max * 100)}%`, background: color }} /></div><p>{metric === "carteira" ? "Carteira atribuída atualmente; não é produtividade." : metric === "atividades" ? "Atividades de todas as datas, separadas do período." : "Eventos atribuídos ao executor registrado."}</p></article>; })}</div>
      {!visible.length ? <p className="rv-empty">Não há registros de colaboradores disponíveis nesta consulta.</p> : null}
      <p className="rv-caption">Os registros não representam todo o trabalho realizado. Os filtros acima alteram os painéis da equipe; o PDF usa o escopo e o período selecionados no início.</p>
    </section>
    <section className="rv-priorities" aria-label="Prioridades da operação">{priorities.map((item, i) => <article className="rv-card" key={item}><span className="rv-priority-index">0{i + 1}</span><p>{item}</p></article>)}</section>
    <footer className="rv-footer"><span>Carteira atual e ações do período são recortes diferentes. Fontes indisponíveis aparecem como “—”.</span>{p.canViewTeam ? <Link href="/report/completo">Relatório completo <ArrowUpRight size={15} /></Link> : null}</footer>
  </section>;
}
