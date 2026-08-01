"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/dashboard/stat-card';
import { OfficeStats } from '@/components/dashboard/office-stats';
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
  AlertTriangle,
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
import { Badge } from '@/components/ui/badge';
import { fetchRepoCases } from '@/app/actions/case-actions';
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

export default function Dashboard() {
  const { cases, setCases, locale, updateLastSync } = useAppStore();
  const { courtHealthMap, runInitialHealthCheck } = useDataJudScanStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false);
  const t = getTranslation(locale);

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
    const sample = cases.slice(0, 50).map(c => c.protocolo);
    await runInitialHealthCheck(sample);
    setIsCheckingConnectivity(false);
  };

  const metrics = useMemo(() => {
    const totalRepo = cases.length;
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
   
    const countVencido = ativos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => c.status === 'É Hoje').length;
    const countAtencao = ativos.filter(c => c.status === 'Atenção').length;
    const countSaudavel = ativos.filter(c => c.status === 'No Prazo').length;
    const countSemPrazo = ativos.filter(c => c.status === 'Sem Prazo').length;
    
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    const countDjenNovo = ativos.filter(c => !!c.djen_nova_comunicacao).length;
    const countDjenAuditado = cases.filter(c => !!c.djen_consultado_em).length;

    const countCumprimento = ativos.filter(c => {
      if (c.datajud_encerrado_tribunal) return false;
      if (c.em_cumprimento_sentenca) return true;
      const text = `${c.datajud_ultimo_nome || ''} ${c.observacao || ''}`.toUpperCase();
      return /CUMPRIMENTO DE SENTEN[CÇ]A|FASE DE CUMPRIMENTO|IN[IÍ]CIO DO CUMPRIMENTO|EXECU[ÇC][AÃ]O DE SENTEN[CÇ]A|CUMPRIMENTO PROVIS[OÓ]RIO/.test(text);
    }).length;

    const rateAndamento = activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;
    const rateEncerrado = activeTotal > 0 ? Math.round((countEncerradoTribunal / activeTotal) * 100) : 0;
    const rateDjen = activeTotal > 0 ? Math.round((countDjenNovo / activeTotal) * 100) : 0;
    const rateCumprimento = activeTotal > 0 ? Math.round((countCumprimento / activeTotal) * 100) : 0;
   
    const riskSum = (countVencido * 1.0) + (countHoje * 0.8) + (countAtencao * 0.5) + (countSaudavel * 0.1);
    const riskScore = activeTotal > 0 ? Math.min(100, Math.round((riskSum / activeTotal) * 100)) : 0;

    let riskLabel = "BAIXO";
    let riskColor = "text-emerald-600";
    if (riskScore > 80) { riskLabel = "CRÍTICO"; riskColor = "text-red-600"; }
    else if (riskScore > 60) { riskLabel = "ALTO"; riskColor = "text-orange-600"; }
    else if (riskScore > 40) { riskLabel = "ELEVADO"; riskColor = "text-yellow-600"; }
    else if (riskScore > 20) { riskLabel = "MODERADO"; riskColor = "text-amber-600"; }

    const pctHoje = activeTotal > 0 ? Math.round((countHoje / activeTotal) * 100) : 0;
    const pctVencidos = activeTotal > 0 ? Math.round((countVencido / activeTotal) * 100) : 0;

    const statusData = [
      { name: t.statusCritico, value: countVencido, color: '#ef4444' },
      { name: t.statusHoje, value: countHoje, color: '#3b82f6' },
      { name: t.statusAtencao, value: countAtencao, color: '#f97316' },
      { name: t.statusPrazo, value: countSaudavel, color: '#10b981' },
      { name: t.statusSemPrazo, value: countSemPrazo, color: '#94a3b8' }
    ].filter(d => d.value > 0);

    return { 
      totalRepo,
      activeTotal, 
      countVencido, 
      countHoje, 
      countAtencao, 
      countSaudavel, 
      countSemPrazo,
      riskScore, riskLabel, riskColor, statusData, pctHoje, pctVencidos,
      countNovoAndamento, rateAndamento,
      countEncerradoTribunal, rateEncerrado,
      countDjenNovo, rateDjen, countDjenAuditado,
      countBA, countCumprimento, rateCumprimento
    };
  }, [cases, t]);

  const priorityQueue = useMemo(() => {
    const criticalStatus = ['Caso Crítico', 'Vencido', 'É Hoje', 'Atenção'];
    return cases
      .filter(c => !isCasoEncerrado(c) && (criticalStatus.includes(c.status) || !!c.tem_atualizacao_pos_retorno || !!c.datajud_encerrado_tribunal || !!c.djen_nova_comunicacao))
      .sort((a, b) => {
        const order: Record<string, number> = { 'Caso Crítico': 0, 'Vencido': 1, 'É Hoje': 2, 'Atenção': 3 };
        const diff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
        if (diff !== 0) return diff;
        return (a.diasFaltando || 0) - (b.diasFaltando || 0);
      })
      .slice(0, 6);
  }, [cases]);

  const statsPills = [
    { label: "Vencidos", count: metrics.countVencido, total: metrics.activeTotal, color: "bg-red-500" },
    { label: "Hoje", count: metrics.countHoje, total: metrics.activeTotal, color: "bg-blue-500" },
    { label: "Atenção", count: metrics.countAtencao, total: metrics.activeTotal, color: "bg-orange-500" },
    { label: "Saudáveis", count: metrics.countSaudavel, total: metrics.activeTotal, color: "bg-emerald-500" },
    { label: "Sem Prazo", count: metrics.countSemPrazo, total: metrics.activeTotal, color: "bg-slate-400" }
  ];

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="h-auto border-b border-border/50 bg-card/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:px-10 gap-4 shrink-0 z-40">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <LayoutDashboard size={20} className="text-foreground" />
              <h1 className="font-black text-base sm:text-xl tracking-tight uppercase text-foreground">{t.dashboard}</h1>
            </div>
            <p className="hidden sm:block text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Gabinete Estratégico • W1 Capital</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {(metrics.countNovoAndamento > 0 || metrics.countDjenNovo > 0 || metrics.countBA > 0) && (
              <Badge variant="destructive" className="animate-pulse h-8 px-3 rounded-xl font-black uppercase text-[8px] sm:text-[10px] flex items-center gap-1.5 sm:gap-2">
                <AlertCircle size={14} /> Alerta Ativo
              </Badge>
            )}
            <Button variant="outline" size="sm" asChild className={cn("premium-card h-10 px-4 sm:px-6 rounded-xl text-[11px] font-black uppercase tracking-wider border-none", ui.touch)}>
              <Link href="/report">
                <FileDown size={16} className="mr-2 hidden sm:inline" /> {t.audit}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
               <RefreshCcw size={18} className={cn(loading && "animate-spin text-primary")} />
            </Button>
          </div>
        </header>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 sm:px-10 py-2 border-b border-border/30 bg-card/40 flex items-center justify-between shrink-0">
             <ScrollArea className="w-full">
                <TabsList className="bg-transparent h-10 border-none gap-6 sm:gap-8 w-max">
                   <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black uppercase text-[10px] tracking-widest h-full transition-all">Visão da Carteira</TabsTrigger>
                   <TabsTrigger value="connectivity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 font-black uppercase text-[10px] tracking-widest h-full transition-all">Rede Judicial</TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
             </ScrollArea>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            <TabsContent value="overview" className="p-4 sm:p-10 space-y-10 m-0 max-w-[1600px] mx-auto w-full">
              <section className={ui.metrics5}>
                <StatCard title={t.statusHoje} value={loading ? "..." : metrics.countHoje} icon={<Clock />} color={metrics.countHoje > 0 ? "warning" : "primary"} trend={`${metrics.pctHoje}%`} trendUp={false} />
                <StatCard title={t.statusVencido} value={loading ? "..." : metrics.countVencido} icon={<ShieldAlert />} color="destructive" trend={`${metrics.pctVencidos}%`} trendUp={false} />
                <StatCard title="Novidades" value={loading ? "..." : metrics.countNovoAndamento} icon={<Activity />} color={metrics.countNovoAndamento > 0 ? "warning" : "success"} trend={`${metrics.rateAndamento}%`} trendUp={true} />
                <StatCard title="DJEN" value={loading ? "..." : metrics.countDjenNovo} icon={<Globe />} color={metrics.countDjenNovo > 0 ? "warning" : "primary"} trend={`${metrics.rateDjen}%`} trendUp={true} />
                <StatCard title="Execução" value={loading ? "..." : metrics.countCumprimento} icon={<Scale />} color="primary" trend={`${metrics.rateCumprimento}%`} trendUp={true} />
              </section>
              
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
                <div className="xl:col-span-8 space-y-8">
                   <section className="bg-black text-white p-6 sm:p-8 border-4 border-black rounded-none shadow-[10px_10px_0px_#00D1FF]">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 border-b border-white/10 pb-4 gap-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] flex items-center gap-3">
                           <Zap className="text-primary animate-pulse" size={16}/> Telemetria Forense
                        </h3>
                        <Badge variant="outline" className="border-primary text-primary font-black uppercase text-[8px] px-3">Vigilância 4D Ativa</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Tribunal (DataJud)</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-3xl font-black tabular-nums">{metrics.countNovoAndamento}</span>
                               <span className="text-sm font-black text-primary">({metrics.rateAndamento}%)</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Diário (DJEN)</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-3xl font-black tabular-nums">{metrics.countDjenNovo}</span>
                               <span className="text-sm font-black text-blue-400">({metrics.rateDjen}%)</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Baixas Detectadas</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-3xl font-black tabular-nums">{metrics.countEncerradoTribunal}</span>
                               <span className="text-sm font-black text-emerald-400">({metrics.rateEncerrado}%)</span>
                            </div>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Indícios B.A.</p>
                            <div className="flex items-baseline gap-2">
                               <span className="text-3xl font-black tabular-nums text-red-500">{metrics.countBA}</span>
                               <Badge className="bg-red-500/10 text-red-500 border-none text-[8px] uppercase">Risco</Badge>
                            </div>
                         </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                        <Button asChild variant="ghost" className="h-10 text-[9px] font-black text-primary hover:text-black hover:bg-primary uppercase tracking-widest">
                           <Link href="/notificacoes">Auditar Alertas <ArrowRight size={12} className="ml-2" /></Link>
                        </Button>
                      </div>
                   </section>

                   <section className="premium-card overflow-hidden">
                      <div className="bg-[#f8f9fb] px-6 sm:px-8 py-5 border-b border-border/30 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Target size={18} className="text-primary" />
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Fila de Contato</h3>
                         </div>
                         <Button asChild variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest hover:text-primary">
                            <Link href="/tarefas">Ver Fila <ArrowRight size={12} className="ml-2"/></Link>
                         </Button>
                      </div>
                      <div className={ui.tableWrap}>
                         <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-white border-b border-border/20">
                               <tr className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">
                                  <th className="px-8 py-3">Cliente / Protocolo</th>
                                  <th className="px-8 py-3">Status / Alerta</th>
                                  <th className="px-8 py-3">Último Movimento</th>
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
                                        <div className="flex flex-wrap gap-2">
                                          <Badge variant="outline" className={cn(
                                             "text-[8px] font-black uppercase px-2 py-0 border-none",
                                             c.status === 'Caso Crítico' ? "bg-red-600 text-white animate-pulse" : 
                                             c.status === 'Vencido' ? "bg-red-50 text-red-600" :
                                             c.status === 'É Hoje' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                                          )}>
                                             {c.status}
                                          </Badge>
                                        </div>
                                     </td>
                                     <td className="px-8 py-4">
                                        <div className="flex items-center gap-2 max-w-[200px]">
                                           <span className="text-[9px] font-bold uppercase truncate opacity-60">
                                              {c.datajud_ultimo_nome || "Sem histórico"}
                                           </span>
                                        </div>
                                     </td>
                                     <td className="px-8 py-4 text-right">
                                        <Button asChild variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg group-hover:bg-primary group-hover:text-white transition-all", ui.touch)}>
                                           <Link href={`/cases?search=${c.protocolo}`}><ExternalLink size={14}/></Link>
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
                              <h3 className="text-xs font-black uppercase tracking-tighter">Briefing de Gabinete</h3>
                           </div>
                           <Badge className="bg-black text-white text-[8px] font-black uppercase">IA Ativa</Badge>
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><TrendingUp size={10}/> Pontos Fortes</p>
                              <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic line-clamp-3">
                                "{iaInsights.pontosFortes?.[0] || "Monitoramento de rotina mantido."}"
                              </p>
                           </div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-red-600 flex items-center gap-2"><TrendingDown size={10}/> Riscos</p>
                              <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic line-clamp-3">
                                "{iaInsights.riscosDetectados?.[0] || "Nenhum risco crítico identificado."}"
                              </p>
                           </div>
                        </div>
                        <Button asChild variant="ghost" className="w-full h-10 border-2 border-black rounded-none text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                           <Link href="/notes">Ver Parecer Completo <ChevronRight size={12}/></Link>
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
                          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</h3>
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
                              <RechartsTooltip />
                           </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-6">
                        {statsPills.map((pill) => (
                           <StatusPillDashboard key={pill.label} label={pill.label} count={pill.count} total={metrics.activeTotal} color={pill.color} />
                        ))}
                      </div>
                   </section>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connectivity" className="p-4 sm:p-10 space-y-8 m-0 max-w-[1600px] mx-auto w-full">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-white border border-border/50 p-6 sm:p-8 rounded-2xl shadow-sm">
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Signal size={24} className="text-primary" /> Rede Judicial
                  </h2>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Monitoramento DataJud (CNJ)</p>
                </div>
                <Button 
                  onClick={handleConnectivityCheck} 
                  disabled={isCheckingConnectivity || cases.length === 0}
                  className={cn("h-12 bg-black text-white hover:bg-primary hover:text-black font-black uppercase text-[10px] tracking-widest px-8 rounded-xl shadow-lg border-2 border-black w-full lg:w-auto", ui.touch)}
                >
                  {isCheckingConnectivity ? <Loader2 size={16} className="animate-spin mr-2"/> : <Wifi size={16} className="mr-2"/>}
                  Auditar Conexões
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.values(courtHealthMap).length > 0 ? (
                  Object.values(courtHealthMap).sort((a,b) => b.successRate - a.successRate).map((health) => (
                    <div key={health.id} className="premium-card p-6 space-y-6 bg-white border-2 border-transparent hover:border-black transition-all group">
                       <div className="flex items-center justify-between">
                          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center font-black text-sm uppercase">
                            {health.id}
                          </div>
                          <Badge className={cn(
                            "font-black uppercase text-[8px] border-none px-2",
                            health.status === 'online' ? "bg-emerald-500 text-white" : 
                            health.status === 'slow' ? "bg-orange-500 text-white" : "bg-red-500 text-white"
                          )}>
                            {health.status === 'online' ? 'Online' : health.status === 'slow' ? 'Lento' : 'Instável'}
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
                     <p className="text-xs font-black uppercase tracking-widest text-center">Inicie uma auditoria para popular o mapa.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        <footer className="hidden sm:flex h-10 border-t border-border/50 bg-card/60 items-center justify-center gap-6 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Advanced Monitoring • Davi Alves Figueredo</span>
        </footer>
      </main>
    </div>
  );
}

function StatusPillDashboard({ label, count, total, color }: { label: string; count: number; total: number; color: string; }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black tracking-wide text-muted-foreground uppercase">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black tabular-nums">{count}</span>
          <span className="text-[8px] font-bold text-muted-foreground opacity-40">({pct}%)</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}