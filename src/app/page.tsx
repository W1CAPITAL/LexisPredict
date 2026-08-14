"use client";
import {
  countEditadosAppSemana,
  countEditadosAppHoje,
  countAuditadosTribunalSemana,
} from "@/lib/processos-auditados";


import { statusEfetivo } from "@/lib/prazo-status";
import { LexisChartTooltip } from '@/components/charts/lexis-chart-tooltip';
import { Dashboard as EfferdPanelRaw } from "@/components/dashboard/efferd-dashboard-panel";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/dashboard/stat-card'
import { BiCompliancePanel } from '@/components/dashboard/bi-compliance-panel';

const EfferdPanel = memo(EfferdPanelRaw);
const OfficeStats = dynamic(() => import('@/components/dashboard/office-stats').then((m) => m.OfficeStats), {
  ssr: false,
  loading: () => null,
});
import {
  ShieldAlert,
  RefreshCcw,
  FileDown,
  Copyright,
  TrendingUp,
  Clock,
  Zap,
  TrendingDown,
  Sparkles,
  LayoutDashboard,
  Target,
  ArrowRight,
  Activity,
  AlertCircle,
  Gavel,
  CheckCircle2,
  PieChart as PieChartIcon,
  Layers,
  Briefcase,
  History,
  ExternalLink,
  Wifi,
  Signal,
  Globe,
  Network,
  Loader2,
  Scale,
  BrainCircuit,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/responsive-ui';
import { Button } from '@/components/ui/button';
import { MetalButton } from '@/components/ui/metal-button';
import { Badge } from '@/components/ui/badge';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { fetchBaHitProtocolosAction } from '@/app/actions/ba-metrics-actions';
import { countBaFromCases } from '@/lib/flags-operacionais';
import { ordenarFilaCritica, pesoFila } from '@/lib/fila-prioridade';
import Link from 'next/link';
import { getTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/use-app-store';
import { useDataJudScanStore } from '@/store/use-datajud-scan-store';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip
} from 'recharts';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { RevisionalJuridicoKpis } from "@/components/dashboard/revisional-juridico-kpis";

export default function Dashboard() {
  const { cases, setCases, locale, updateLastSync, sync } = useAppStore();
  const { courtHealthMap, runInitialHealthCheck } = useDataJudScanStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [baHitDigits, setBaHitDigits] = useState<string[]>([]);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false);
  const lastSync = sync?.lastSync ?? null;
  const t = useMemo(() => getTranslation(locale), [locale]);

  const loadInsights = useCallback(() => {
    if (typeof window === 'undefined') return;
    const savedInsights = localStorage.getItem('lexisPredict_notes_analysis');
    if (savedInsights) {
      try { setIaInsights(JSON.parse(savedInsights)); } catch (e) { setIaInsights(null); }
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const caseData = await fetchRepoCases();
        try {
          const baRes = await fetchBaHitProtocolosAction();
          if (baRes.success) setBaHitDigits(baRes.protocolDigits || []);
        } catch { /* */ }
      if (Array.isArray(caseData)) {
        setCases(caseData);
        updateLastSync();
      }
    } finally {
      setLoading(false);
    }
  }, [setCases, updateLastSync]);

  useEffect(() => {
    setMounted(true);
    loadInsights();
    loadData();

    const handleStorageUpdate = () => loadInsights();
    window.addEventListener('lexis-insights-updated', handleStorageUpdate);
    return () => window.removeEventListener('lexis-insights-updated', handleStorageUpdate);
  }, [loadInsights, loadData]);

  const handleConnectivityCheck = async () => {
    if (cases.length === 0 || isCheckingConnectivity) return;
    setIsCheckingConnectivity(true);
    const sample = cases.slice(0, 10).map(c => c.protocolo);
    await runInitialHealthCheck(sample);
    setIsCheckingConnectivity(false);
  };

  const metrics = useMemo(() => {
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
   
    const countVencido = ativos.filter(c => statusEfetivo(c) === 'Vencido' || c.status === 'Caso Crítico' || c.statusManual === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => statusEfetivo(c) === 'É Hoje').length;
    const countAtencao = ativos.filter(c => statusEfetivo(c) === 'Atenção').length;
    const countSaudavel = ativos.filter(c => statusEfetivo(c) === 'No Prazo').length;
    const countSemPrazo = ativos.filter(c => c.status === 'Sem Prazo').length;
    
    // UNIFICAÇÃO DE SINAL (DataJud ∪ DJEN)
    const countNovoAndamento = ativos.filter(c => !!c.tem_novo_andamento || !!c.tem_atualizacao_pos_retorno).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countEditadosApp = countEditadosAppSemana(cases as any);
    const countAuditadosTribunal = countAuditadosTribunalSemana(cases as any);
    const countAuditadosHojeN = countEditadosAppHoje(cases as any);
    const countAuditadosSemana = countEditadosApp;
    const baSet = new Set((baHitDigits || []).map((x) => String(x).replace(/\D/g, '')));
    const countBA = countBaFromCases(ativos as any, baSet);
    const countCumprimento = ativos.filter(c => !!c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca').length;
    // MÉRITO OBRIGATÓRIO
    const countProcedente = ativos.filter(c =>
      c.evento_tipo === 'sentenca_procedente' ||
      /PROCEDENTE/i.test(String(c.evento_resumo || '')) && !/IMPROCEDENTE/i.test(String(c.evento_resumo || ''))
    ).length;
    const countImprocedente = ativos.filter(c =>
      c.evento_tipo === 'sentenca_improcedente' ||
      /IMPROCEDENTE/i.test(String(c.evento_resumo || c.datajud_ultimo_nome || ''))
    ).length;
    const countAudiencia = ativos.filter(c =>
      String(c.evento_tipo || '').includes('audiencia')
    ).length;

    const rateAndamento = activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;
   
    const riskSum = (countVencido * 1.0) + (countHoje * 0.8) + (countAtencao * 0.5) + (countSaudavel * 0.1);
    const riskScore = activeTotal > 0 ? Math.min(100, Math.round((riskSum / activeTotal) * 100)) : 0;

    let riskLabel = "BAIXO";
    let riskColor = "text-emerald-600";
    if (riskScore > 80) { riskLabel = "CRÍTICO"; riskColor = "text-red-600"; }
    else if (riskScore > 60) { riskLabel = "ALTO"; riskColor = "text-orange-600"; }
    else if (riskScore > 40) { riskLabel = "ELEVADO"; riskColor = "text-yellow-600"; }
    else if (riskScore > 20) { riskLabel = "MODERADO"; riskColor = "text-amber-600"; }

    const statusData = [
      { name: t.statusCritico, value: countVencido, color: '#ef4444' },
      { name: t.statusHoje, value: countHoje, color: '#3b82f6' },
      { name: t.statusAtencao, value: countAtencao, color: '#f97316' },
      { name: t.statusPrazo, value: countSaudavel, color: '#10b981' },
      { name: t.statusSemPrazo, value: countSemPrazo, color: '#94a3b8' }
    ].filter(d => d.value > 0);

    return { 
      activeTotal, countVencido, countHoje, countAtencao, countSaudavel, countSemPrazo,
      riskScore, riskLabel, riskColor, statusData,
      countNovoAndamento, rateAndamento,
      countEncerradoTribunal, countBA, countCumprimento, countAuditadosSemana, countAuditadosTribunal, countEditadosApp, countAuditadosHoje: countAuditadosHojeN,
      countProcedente, countImprocedente, countAudiencia
    };
  }, [cases, t, baHitDigits]);

  const priorityQueue = useMemo(() => {
    return cases
      .filter(c => !isCasoEncerrado(c) && (['Caso Crítico', 'Vencido', 'É Hoje'].includes(c.status) || !!c.tem_novo_andamento))
      .sort((a, b) => {
        if (!!a.datajud_encerrado_tribunal !== !!b.datajud_encerrado_tribunal) return a.datajud_encerrado_tribunal ? -1 : 1;

        const getWeight = (tipo?: string) => {
           if (!tipo) return 0;
           if (tipo.includes('sentenca')) return 100;
           if (tipo.includes('audiencia')) return 80;
           if (tipo.includes('cumprimento')) return 60;
           return 0;
        };
        const weightDiff = getWeight(b.evento_tipo) - getWeight(a.evento_tipo);
        if (weightDiff !== 0) return weightDiff;

        const order: Record<string, number> = { 'Caso Crítico': 0, 'Vencido': 1, 'É Hoje': 2 };
        const statusDiff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        
        return (a.diasFaltando || 0) - (b.diasFaltando || 0);
      })
      .slice(0, 6);
  }, [cases]);

  const isEmpty = !loading && cases.length === 0;

  const upcomingDeadlines = useMemo(() => {
    return cases
      .filter(c => !isCasoEncerrado(c) && typeof c.diasFaltando === 'number' && c.diasFaltando >= 0 && c.diasFaltando <= 7)
      .sort((a, b) => (a.diasFaltando || 0) - (b.diasFaltando || 0))
      .slice(0, 5);
  }, [cases]);

  if (!mounted) return null;

  return (
    <div className="ops-ui admin-ui flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden texture-bg", ui.main)}>
        <header className="admin-page-header h-auto flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <LayoutDashboard size={20} className="text-foreground" />
              <h1 className="admin-page-title text-base sm:text-xl text-foreground">{t.dashboard}</h1>
            </div>
            <p className="hidden sm:block text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Visão da carteira</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {(metrics.countNovoAndamento > 0 || metrics.countBA > 0) && (
              <Badge
                variant="destructive"
                className="h-8 px-3 rounded-xl font-semibold text-[9px] sm:text-[10px] flex items-center gap-1.5 sm:gap-2 max-w-[min(100%,280px)]"
                title="Processos com andamento novo após o último contato e/ou indício de busca e apreensão ainda sem tratamento"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span className="truncate">
                  {metrics.countBA > 0 && metrics.countNovoAndamento > 0
                    ? `${metrics.countNovoAndamento} novidade(s) · ${metrics.countBA} B.A.`
                    : metrics.countBA > 0
                      ? `${metrics.countBA} indício(s) de busca e apreensão`
                      : `${metrics.countNovoAndamento} andamento(s) novo(s) sem atendimento`}
                </span>
              </Badge>
            )}
            <MetalButton preset="chromatic" strength={1} variant="outline" size="sm" asChild className={cn("h-10 px-4 sm:px-6 rounded-full text-[11px] font-black uppercase tracking-wider", ui.touch)}>
              <Link href="/report">
                <FileDown size={16} className="mr-2 hidden sm:inline" /> Dossiê Operacional
              </Link>
            </MetalButton>
            <MetalButton preset="silver" strength={1} variant="secondary" size="icon" onClick={loadData} className="h-10 w-10 rounded-full" aria-label="Atualizar">
               <RefreshCcw size={18} className={cn(loading && "animate-spin text-primary")} />
            </MetalButton>
            {lastSync && (
              <span className="hidden md:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 shrink-0" title={new Date(lastSync).toLocaleString('pt-BR')}>
                <Clock size={10} /> {new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </header>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-10 py-2 border-b border-border/30 bg-card/40 flex items-center justify-between shrink-0">
             <ScrollArea className="w-full">
                <TabsList className="bg-transparent h-10 border-none gap-6 sm:gap-8 w-max">
                   <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 font-semibold uppercase text-[11px] tracking-wider h-full text-muted-foreground transition-all">Visão da Carteira</TabsTrigger>
                   <TabsTrigger value="connectivity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 font-semibold uppercase text-[11px] tracking-wider h-full text-muted-foreground transition-all">Rede Judicial</TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
             </ScrollArea>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            <TabsContent value="overview" className="p-4 sm:p-10 space-y-10 m-0 max-w-[1600px] mx-auto w-full">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/30 rounded-2xl space-y-6 text-center animate-in fade-in duration-500 bg-card/30">
                <div className="w-20 h-20 rounded-2xl bg-black text-white flex items-center justify-center shadow-[10px_10px_0px_#00D1FF]">
                  <Briefcase size={32} />
                </div>
                <div className="space-y-1 px-6">
                  <h3 className="font-black uppercase tracking-tight text-base sm:text-lg">Nenhum caso carregado</h3>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest max-w-sm mx-auto">
                    Importe a carteira para liberar a vigilância unificada, o risco global e a fila prioritária.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button asChild className="h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest bg-foreground text-background hover:bg-primary hover:text-primary-foreground">
                    <Link href="/import">Importar Carteira</Link>
                  </Button>
                  <MetalButton preset="silver" strength={1} variant="outline" size="sm" onClick={loadData} className="h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    <RefreshCcw size={14} className="mr-2" /> Recarregar
                  </MetalButton>
                </div>
              </div>
            )}
            {!isEmpty && (<>
            {/* EFFORD — topo do dashboard */}
            <div className="mb-6">
              <section className="rounded-2xl border border-border/50 bg-card/50 p-3 sm:p-5 shadow-sm backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-3 px-1">Indicadores</p>
                <EfferdPanel
                  totalProcessos={cases.length}
                  ativos={metrics.activeTotal}
                  pendentes={metrics.countNovoAndamento + metrics.countHoje}
                  vencidos={metrics.countVencido}
                  novidades={metrics.countNovoAndamento}
                  baixas={metrics.countEncerradoTribunal}
                  hoje={metrics.countHoje}
                  riskScore={metrics.riskScore}
                  cases={cases}
                  editadosSemana={metrics.countEditadosApp ?? metrics.countAuditadosSemana ?? 0}
                  editadosHoje={metrics.countAuditadosHoje ?? 0}
                  tribunalSemana={metrics.countAuditadosTribunal ?? 0}
                />
              </section>
            </div>

              <section className={ui.metrics5}>
                <StatCard title={t.statusHoje} value={loading ? "..." : metrics.countHoje} icon={<Clock />} color={metrics.countHoje > 0 ? "warning" : "primary"} />
                <StatCard title={t.statusVencido} value={loading ? "..." : metrics.countVencido} icon={<ShieldAlert />} color="destructive" />
                <StatCard title="Andamentos" value={loading ? "..." : metrics.countNovoAndamento} icon={<Activity />} color={metrics.countNovoAndamento > 0 ? "warning" : "success"} />
                <StatCard title="Baixas" value={loading ? "..." : metrics.countEncerradoTribunal} icon={<Gavel />} color="success" />
                <StatCard title="Risco Global" value={`${metrics.riskScore}%`} icon={<Scale />} color="primary" />
              </section>

              {/* CONTADORES DE MÉRITO — obrigatório */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="merit-counters">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/30 p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">Procedentes</p>
                    <p className="text-3xl font-black tabular-nums text-emerald-700">{loading ? "..." : metrics.countProcedente}</p>
                  </div>
                  <Scale className="text-emerald-600/40" size={28} />
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50/80 dark:bg-red-950/30 p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-700/80">Improcedentes</p>
                    <p className="text-3xl font-black tabular-nums text-red-700">{loading ? "..." : metrics.countImprocedente}</p>
                  </div>
                  <Gavel className="text-red-600/40" size={28} />
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 p-5 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700/80">Audiências · Cumprimento</p>
                    <p className="text-3xl font-black tabular-nums text-blue-700">{loading ? "..." : `${metrics.countAudiencia} · ${metrics.countCumprimento}`}</p>
                  </div>
                  <Activity className="text-blue-600/40" size={28} />
                </div>
              </section>
{/* G2 — KPIs Revisional & Jurídico */}
              <RevisionalJuridicoKpis />
              
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
                <div className="xl:col-span-8 space-y-8">
                   <section className="bg-black text-white p-6 sm:p-8 border-4 border-black rounded-none shadow-[10px_10px_0px_#00D1FF]">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 border-b border-white/10 pb-4 gap-4">
                        <h3 className="text-xs font-black uppercase tracking-wide flex items-center gap-3">
                           <Zap className="text-primary animate-pulse" size={16}/> Andamentos e publicações
                        </h3>
                        <Badge variant="outline" className="border-primary text-primary font-black uppercase text-[8px] px-3">Operação</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Eventos Híbridos</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-4xl font-black tabular-nums">{metrics.countNovoAndamento}</span>
                               <span className="text-sm font-black text-primary">({metrics.rateAndamento}%)</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Baixas Reais</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-4xl font-black tabular-nums text-emerald-400">{metrics.countEncerradoTribunal}</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Indícios B.A.</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-4xl font-black tabular-nums text-red-500">{metrics.countBA}</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Execução Ativa</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-4xl font-black tabular-nums text-blue-400">{metrics.countCumprimento}</span>
                            </div>
                         </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                        <Button asChild variant="ghost" className="h-10 text-[9px] font-black text-primary hover:text-black hover:bg-primary uppercase tracking-widest">
                           <Link href="/tarefas">Ver Fila de Tarefas <ArrowRight size={12} className="ml-2" /></Link>
                        </Button>
                      </div>
                   </section>

                   <section className="premium-card overflow-hidden">
                      <div className="bg-secondary/50 dark:bg-card/70 px-6 sm:px-8 py-5 border-b border-border/30 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Target size={18} className="text-primary" />
                            <h3 className="text-[11px] font-black uppercase tracking-wide">Fila de contato</h3>
                         </div>
                         <Button asChild variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest hover:text-primary">
                            <Link href="/tarefas">Abrir Fila Completa <ArrowRight size={12} className="ml-2"/></Link>
                         </Button>
                      </div>
                      <div className={ui.tableWrap}>
                          <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-secondary/50 dark:bg-card/80 border-b border-border/20">
                               <tr className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">
                                  <th className="px-8 py-3">Cliente / Protocolo</th>
                                  <th className="px-8 py-3">Natureza do Evento</th>
                                  <th className="px-8 py-3 text-right">Ação</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-border/10">
                               {priorityQueue.map((c) => (
                                  <tr key={c.id} className="hover:bg-secondary/10 group transition-colors">
                                     <td className="px-8 py-4">
                                        <div className="flex flex-col">
                                           <span className="text-[11px] font-black uppercase group-hover:text-primary transition-colors">{c.cliente}</span>
                                           <span className={cn("text-[8px] font-mono opacity-40", ui.cnj)}>{c.protocolo}</span>
                                        </div>
                                     </td>
                                     <td className="px-8 py-4">
                                        <div className="flex flex-col gap-1">
                                           <Badge variant="outline" className={cn(
                                              "text-[8px] font-black uppercase px-2 py-0 border-none w-fit",
                                              
                                              c.status === 'Vencido'
                                                ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                                                : "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
                                           )}>
                                             {c.status}
                                          </Badge>
                                          <span className="text-[9px] font-bold text-foreground/70 uppercase truncate max-w-[250px]">
                                            {c.evento_resumo || c.djen_ultimo_resumo || c.datajud_ultimo_nome || 'Acompanhamento Regular'}
                                          </span>
                                        </div>
                                     </td>
                                     <td className="px-8 py-4 text-right">
                                        <Button asChild variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg group-hover:bg-foreground group-hover:text-background transition-all", ui.touch)}>
                                           <Link href={`/cases?search=${c.protocolo}`}><ChevronRight size={14}/></Link>
                                        </Button>
                                     </td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </section>

                <OfficeStats cases={cases} />
                </div>

                <div className="xl:col-span-4 space-y-8">
                   {iaInsights && (
                     <section className="bg-white border-2 border-black p-6 sm:p-8 rounded-none shadow-[8px_8px_0px_#000] space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between border-b-2 border-black/5 pb-4">
                           <div className="flex items-center gap-3">
                              <BrainCircuit className="text-primary" size={20} />
                              <h3 className="text-xs font-black uppercase tracking-tighter">Resumo do dia</h3>
                           </div>
                           <Badge className="bg-black text-white text-[8px] font-black uppercase">IA Ativa</Badge>
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><TrendingUp size={10}/> Vantagens Técnicas</p>
                              <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic line-clamp-3">
                                "{iaInsights.pontosFortes?.[0] || "Monitoramento regular mantido."}"
                              </p>
                           </div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-red-600 flex items-center gap-2"><TrendingDown size={10}/> Riscos Operacionais</p>
                              <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic line-clamp-3">
                                "{iaInsights.riscosDetectados?.[0] || "Nenhum risco crítico identificado."}"
                              </p>
                           </div>
                        </div>
                        <Button asChild variant="ghost" className="w-full h-10 border-2 border-black rounded-none text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                           <Link href="/notes">Auditoria de Evidências <ChevronRight size={12}/></Link>
                        </Button>
                     </section>
                   )}

                   {upcomingDeadlines.length > 0 && (
                     <section className="premium-card p-6 sm:p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Clock size={14} className="text-primary" />
                            <h3 className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Próximos Prazos · 7 dias</h3>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-primary text-primary">
                            {upcomingDeadlines.length}
                          </Badge>
                        </div>
                        <div className="space-y-0">
                          {upcomingDeadlines.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-3 py-3 border-b border-border/20 last:border-0">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase truncate leading-tight">{c.cliente}</p>
                                <p className="text-[8px] font-mono opacity-40 truncate mt-0.5">{c.protocolo}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={cn("text-sm font-black tabular-nums leading-none", (c.diasFaltando || 0) <= 1 ? "text-red-600" : "text-amber-600")}>
                                  {c.diasFaltando}d
                                </span>
                                <p className="text-[7px] font-bold text-muted-foreground/70 uppercase tracking-widest mt-1">{c.status}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button asChild variant="ghost" className="w-full h-8 mt-4 text-[9px] font-black uppercase tracking-widest hover:text-primary">
                          <Link href="/tarefas">Ver Fila de Tarefas <ArrowRight size={12} className="ml-2" /></Link>
                        </Button>
                     </section>
                   )}

                   <section className="premium-card p-6 sm:p-8 space-y-8">
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                           <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.riskIndex}</p>
                           <h4 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none">{metrics.riskScore}%</h4>
                         </div>
                         <Badge variant="outline" className={cn("border-2 font-black uppercase text-[10px] px-3 py-1", metrics.riskColor, metrics.riskColor.replace('text', 'border'))}>
                            {metrics.riskLabel}
                         </Badge>
                      </div>
                      <div className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                        <div className={cn("h-full transition-all duration-1000", metrics.riskColor.replace('text', 'bg'))} style={{ width: `${metrics.riskScore}%` }} />
                      </div>
                   </section>

                   <section className="premium-card p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <PieChartIcon size={16} className="text-primary" />
                          <h3 className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Saúde da Carteira</h3>
                        </div>
                      </div>
                      <div className="h-[200px] w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie
                                 data={metrics.statusData}
                                 innerRadius={60}
                                 outerRadius={80}
                                 paddingAngle={5}
                                 dataKey="value"
                                 stroke="none"
                              >
                                 {metrics.statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                 ))}
                              </Pie>
                              <RechartsTooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} wrapperStyle={{ outline: "none", zIndex: 50 }} />
                           </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-6">
                        {metrics.statusData.map((item) => (
                           <div key={item.name} className="space-y-2">
                             <div className="flex items-center justify-between">
                               <span className="text-[9px] font-black tracking-wide text-muted-foreground uppercase">{item.name}</span>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black tabular-nums">{item.value}</span>
                                 <span className="text-[8px] font-bold text-muted-foreground opacity-40">({Math.round((item.value / (metrics.activeTotal || 1)) * 100)}%)</span>
                               </div>
                             </div>
                             <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                               <div className="h-full bg-primary" style={{ width: `${(item.value / (metrics.activeTotal || 1)) * 100}%`, backgroundColor: item.color }} />
                             </div>
                           </div>
                        ))}
                      </div>
                   </section>
              </div>
            </div>
            </>)}
            
              {/* BI recolhível — dentro do scroll, não fora */}
              <BiCompliancePanel cases={cases} defaultOpen={false} className="mt-2" />

</TabsContent>

            <TabsContent value="connectivity" className="p-4 sm:p-10 space-y-8 m-0 max-w-[1600px] mx-auto w-full">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-card border border-border/50 p-6 sm:p-8 rounded-2xl shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Signal size={24} className="text-primary" /> Rede Judicial
                  </h2>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Vigilância Digital DataJud (CNJ)</p>
                </div>
                <Button 
                  onClick={handleConnectivityCheck} 
                  disabled={isCheckingConnectivity || cases.length === 0}
                  className={cn("h-11 bg-foreground text-background hover:bg-primary hover:text-primary-foreground font-semibold uppercase text-[11px] tracking-wide px-6 rounded-xl shadow-sm w-full lg:w-auto", ui.touch)}
                >
                  {isCheckingConnectivity ? <Loader2 size={16} className="animate-spin mr-2"/> : <Wifi size={16} className="mr-2"/>}
                  Auditar Latência de Tribunais
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.values(courtHealthMap).length > 0 ? (
                  Object.values(courtHealthMap).sort((a,b) => b.successRate - a.successRate).map((health) => (
                    <div key={health.id} className="premium-card p-5 space-y-5 hover:border-primary/30 transition-all group">
                       <div className="flex items-center justify-between">
                          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center font-black text-sm uppercase">
                            {health.id}
                          </div>
                          <Badge className={cn(
                            "font-black uppercase text-[8px] border-none px-2",
                            health.status === 'online' ? "bg-emerald-500 text-white" : 
                            health.status === 'slow' ? "bg-orange-500 text-white" : "bg-red-500 text-white"
                          )}>
                            {health.status === 'online' ? 'Online' : health.status === 'slow' ? 'Instável' : 'Offline'}
                          </Badge>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="flex justify-between items-end">
                             <div className="space-y-0.5">
                                <p className="text-[8px] font-black uppercase text-muted-foreground">Latência</p>
                                <p className="text-xl font-black tabular-nums">{Math.round(health.avgLatency)}ms</p>
                             </div>
                             <div className="text-right space-y-0.5">
                                <p className="text-[8px] font-black uppercase text-muted-foreground">Sucesso</p>
                                <p className="text-xl font-black tabular-nums text-primary">{Math.round(health.successRate * 100)}%</p>
                             </div>
                          </div>
                          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                             <div 
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  health.status === 'online' ? "bg-emerald-500" : 
                                  health.status === 'slow' ? "bg-orange-500" : "bg-red-500"
                                )} 
                                style={{ width: `${health.successRate * 100}%` }} 
                             />
                          </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 space-y-4 border-2 border-dashed border-border/20 rounded-2xl">
                     <Network size={48} />
                     <p className="text-xs font-black uppercase tracking-widest text-center">Inicie uma auditoria para popular o mapa de rede.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        

<footer className="hidden sm:flex h-10 border-t border-border/50 bg-card/40 items-center justify-center gap-6 text-[10px] text-muted-foreground/70 font-medium uppercase tracking-[0.18em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Monitoramento processual</span>
        </footer>
      </main>
    </div>
  );
}