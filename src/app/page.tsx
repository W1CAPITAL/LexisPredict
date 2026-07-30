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
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchRepoCases } from '@/app/actions/case-actions';
import Link from 'next/link';
import { getTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/use-app-store';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export default function Dashboard() {
  const { cases, setCases, locale, sync, updateLastSync } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [iaInsights, setIaInsights] = useState<any>(null);
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

  const metrics = useMemo(() => {
    const totalRepo = cases.length;
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
   
    // Categorias de Status dos Ativos (SINCRONIZAÇÃO v350.0 - UM ÚNICO MOTOR)
    const countVencido = ativos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => c.status === 'É Hoje').length;
    const countAtencao = ativos.filter(c => c.status === 'Atenção').length;
    const countSaudavel = ativos.filter(c => c.status === 'No Prazo').length;
    const countSemPrazo = ativos.filter(c => c.status === 'Sem Prazo').length;
    
    // Alertas DataJud baseados em ativos com cast de verdade absoluta (!!)
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    const rateAndamento = activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;
    const rateEncerrado = activeTotal > 0 ? Math.round((countEncerradoTribunal / activeTotal) * 100) : 0;
    const rateBA = activeTotal > 0 ? Math.round((countBA / activeTotal) * 100) : 0;
   
    // Índice de Risco Global
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
      countBA, rateBA
    };
  }, [cases, t]);

  const priorityQueue = useMemo(() => {
    const criticalStatus = ['Caso Crítico', 'Vencido', 'É Hoje', 'Atenção'];
    return cases
      .filter(c => !isCasoEncerrado(c) && criticalStatus.includes(c.status))
      .sort((a, b) => {
        const order: Record<string, number> = { 'Caso Crítico': 0, 'Vencido': 1, 'É Hoje': 2, 'Atenção': 3 };
        const diff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
        if (diff !== 0) return diff;
        return (a.diasFaltando || 0) - (b.diasFaltando || 0);
      })
      .slice(0, 6);
  }, [cases]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <LayoutDashboard size={20} className="text-foreground" />
              <h1 className="font-black text-xl tracking-tight uppercase text-foreground">{t.dashboard}</h1>
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Gabinete Estratégico • W1 Capital</p>
          </div>
          <div className="flex items-center gap-4">
            {metrics.countNovoAndamento > 0 && (
              <Badge variant="destructive" className="animate-pulse h-8 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-2">
                <AlertCircle size={14} /> {metrics.countNovoAndamento} Atualizações no Tribunal
              </Badge>
            )}
            <Badge variant="outline" className="text-[9px] font-black uppercase border-none bg-secondary/50 px-3">
              {t.activeTelemetry}: {sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString() : '...'}
            </Badge>
            <Button variant="outline" size="sm" asChild className="premium-card h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-wider border-none">
              <Link href="/report">
                <FileDown size={16} className="mr-2" /> {t.audit}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl hover:bg-secondary">
               <RefreshCcw size={18} className={cn(loading && "animate-spin text-primary")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 space-y-10 max-w-[1600px] mx-auto w-full">
          {/* TOP KPI CARDS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={t.statusHoje} value={loading ? "..." : metrics.countHoje} icon={<Clock />} color={metrics.countHoje > 0 ? "warning" : "primary"} trend={`${metrics.pctHoje}%`} trendUp={false} />
            <StatCard title={t.statusVencido} value={loading ? "..." : metrics.countVencido} icon={<ShieldAlert />} color="destructive" trend={`${metrics.pctVencidos}%`} trendUp={false} />
            <StatCard title="Novos Andamentos" value={loading ? "..." : metrics.countNovoAndamento} icon={<Activity />} color={metrics.countNovoAndamento > 0 ? "warning" : "success"} trend={`${metrics.rateAndamento}%`} trendUp={true} />
            <StatCard title="Encerrados Tribunal" value={loading ? "..." : metrics.countEncerradoTribunal} icon={<Gavel />} color={metrics.countEncerradoTribunal > 0 ? "success" : "primary"} trend={`${metrics.rateEncerrado}%`} trendUp={true} />
          </section>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
            <div className="xl:col-span-8 space-y-8">
               {/* TELEMETRIA DATAJUD - BLOCO ÚNICO SINCRO v350.0 */}
               <section className="bg-black text-white p-8 border-4 border-black rounded-none shadow-[10px_10px_0px_#00D1FF] group transition-all">
                  <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.4em] flex items-center gap-3">
                       <Zap className="text-primary animate-pulse" size={16}/> Telemetria Forense (DataJud)
                    </h3>
                    <Badge variant="outline" className="border-primary text-primary font-black uppercase text-[8px] px-3">Auditoria Ativa</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Andamentos Judiciais não atendidos</p>
                        <div className="flex items-baseline gap-4">
                           <span className="text-4xl font-black tabular-nums tracking-tighter">
                             {metrics.countNovoAndamento} <span className="text-lg opacity-40">de {metrics.activeTotal}</span>
                           </span>
                           <span className="text-xl font-black text-primary tabular-nums">({metrics.rateAndamento}%)</span>
                        </div>
                        <p className="text-[8px] font-bold uppercase italic text-white/40 leading-relaxed">
                          Métrica de vigilância: processos com movimentos novos após o último contato.
                        </p>
                     </div>
                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Baixas identificadas no Tribunal</p>
                        <div className="flex items-baseline gap-4">
                           <span className="text-4xl font-black tabular-nums tracking-tighter">
                             {metrics.countEncerradoTribunal} <span className="text-lg opacity-40">de {metrics.activeTotal}</span>
                           </span>
                           <span className="text-xl font-black text-emerald-400 tabular-nums">({metrics.rateEncerrado}%)</span>
                        </div>
                        <p className="text-[8px] font-bold uppercase italic text-white/40 leading-relaxed">
                          Métrica de resolutividade: ritos de encerramento detectados via auditoria CNJ.
                        </p>
                     </div>
                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Indícios de Busca e Apreensão</p>
                        <div className="flex items-baseline gap-4">
                           <span className="text-4xl font-black tabular-nums tracking-tighter">
                             {metrics.countBA} <span className="text-lg opacity-40">de {metrics.activeTotal}</span>
                           </span>
                           <span className="text-xl font-black text-red-400 tabular-nums">({metrics.rateBA}%)</span>
                        </div>
                        <p className="text-[8px] font-bold uppercase italic text-white/40 leading-relaxed">
                          Riscos possessórios detectados via análise neural de movimentos e processos relacionados.
                        </p>
                     </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    <Button asChild variant="ghost" className="h-8 text-[9px] font-black text-primary hover:text-black hover:bg-primary uppercase tracking-widest">
                       <Link href="/cases?filter=updated">Auditar Processos <ArrowRight size={12} className="ml-2" /></Link>
                    </Button>
                  </div>
               </section>

               {/* FILA DE PRIORIDADE */}
               <section className="premium-card overflow-hidden">
                  <div className="bg-[#f8f9fb] px-8 py-5 border-b border-border/30 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <Target size={18} className="text-primary" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Fila Prioritária de Contato</h3>
                     </div>
                     <Button asChild variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest hover:text-primary">
                        <Link href="/tarefas">Ver Fila Completa <ArrowRight size={12} className="ml-2"/></Link>
                     </Button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-white border-b border-border/20">
                           <tr className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">
                              <th className="px-8 py-3">Cliente / Protocolo</th>
                              <th className="px-8 py-3">Status</th>
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
                                       <span className="text-[8px] font-mono opacity-40">{c.protocolo}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-4">
                                    <Badge variant="outline" className={cn(
                                       "text-[8px] font-black uppercase px-2 py-0 border-none",
                                       c.status === 'Caso Crítico' ? "bg-red-600 text-white animate-pulse" : 
                                       c.status === 'Vencido' ? "bg-red-50 text-red-600" :
                                       c.status === 'É Hoje' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                                    )}>
                                       {c.status}
                                    </Badge>
                                 </td>
                                 <td className="px-8 py-4">
                                    <div className="flex items-center gap-2 max-w-[200px]">
                                       <History size={12} className="text-muted-foreground/40 shrink-0" />
                                       <span className="text-[9px] font-bold uppercase truncate opacity-60">
                                          {c.datajud_ultimo_nome || "Sem histórico"}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-4 text-right">
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg group-hover:bg-primary group-hover:text-white transition-all">
                                       <Link href={`/cases?search=${c.protocolo}`}><ExternalLink size={14}/></Link>
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </section>

               {/* BRIEFING IA */}
               <section className="premium-card p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-110 transition-transform pointer-events-none">
                    <Sparkles size={140} />
                  </div>
                  <div className="flex items-center justify-between mb-8 border-b border-border/30 pb-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl shadow-lg">
                         <Zap size={24} />
                       </div>
                       <div>
                         <h3 className="font-black text-lg uppercase tracking-tight leading-none">{t.briefingTitle}</h3>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{t.briefingSubtitle}</p>
                       </div>
                    </div>
                  </div>
                  {iaInsights ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-6">
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-2 tracking-widest bg-emerald-50 dark:bg-emerald-950/30 w-fit px-3 py-1 rounded-full"><TrendingUp size={14}/> {t.strengths}</p>
                          <ul className="space-y-4">
                            {iaInsights.pontosFortes?.slice(0, 4).map((item: string, idx: number) => (
                              <li key={idx} className="text-[12px] font-bold leading-relaxed text-foreground/80 uppercase flex gap-4">
                                <span className="text-emerald-500 font-black shrink-0">0{idx+1}</span> {item}
                              </li>
                            ))}
                          </ul>
                       </div>
                       <div className="space-y-6">
                          <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase flex items-center gap-2 tracking-widest bg-red-50 dark:bg-red-950/30 w-fit px-3 py-1 rounded-full"><TrendingDown size={14}/> {t.risks}</p>
                          <ul className="space-y-4">
                            {iaInsights.riscosDetectados?.slice(0, 4).map((item: string, idx: number) => (
                              <li key={idx} className="text-[12px] font-bold leading-relaxed text-foreground/80 uppercase flex gap-4">
                                <span className="text-red-500 font-black shrink-0">!</span> {item}
                              </li>
                            ))}
                          </ul>
                       </div>
                    </div>
                  ) : (
                    <div className="py-16 flex flex-col items-center justify-center text-center space-y-6 border-2 border-dashed border-border/20 rounded-2xl bg-secondary/10">
                       <Sparkles size={40} className="text-muted-foreground/20" />
                       <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Aguardando Auditoria Neural...</p>
                       <Button variant="link" asChild className="text-[11px] font-black uppercase underline text-primary">
                         <Link href="/notes">Processar Evidências</Link>
                       </Button>
                    </div>
                  )}
               </section>
               
               <OfficeStats cases={cases} />
            </div>

            <div className="xl:col-span-4 space-y-8">
               {/* ÍNDICE DE RISCO */}
               <section className="premium-card p-8 space-y-8">
                  <div className="flex justify-between items-end">
                     <div className="space-y-1">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.riskIndex}</p>
                       <h4 className="text-5xl font-black tracking-tighter leading-none">{metrics.riskScore}%</h4>
                     </div>
                     <Badge variant="outline" className={cn("border-2 font-black uppercase text-[10px] px-3 py-1", metrics.riskColor, metrics.riskColor.replace('text', 'border'))}>
                        {metrics.riskLabel}
                     </Badge>
                  </div>
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                    <div className={cn("h-full transition-all duration-1000", metrics.riskColor.replace('text', 'bg'))} style={{ width: `${metrics.riskScore}%` }} />
                  </div>
               </section>

               {/* DOSSIÊ OPERACIONAL */}
               <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-2 px-2">
                    <Layers size={16} className="text-primary" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Dossiê Operacional</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <DashboardKpiMini label="Ativos em Gestão" value={metrics.activeTotal} icon={<Activity size={12}/>} color="text-blue-600" />
                    <DashboardKpiMini label="Processos Vencidos" value={metrics.countVencido} icon={<AlertTriangle size={12}/>} color="text-red-600" />
                    <DashboardKpiMini label="Casos Saudáveis" value={metrics.countSaudavel} icon={<CheckCircle2 size={12}/>} color="text-emerald-600" />
                    <DashboardKpiMini label="Vencem Hoje" value={metrics.countHoje} icon={<Clock size={12}/>} color="text-orange-600" />
                    <div className="col-span-2">
                      <DashboardKpiMini label="Carteira Total (Escopo)" value={metrics.totalRepo} icon={<Briefcase size={12}/>} color="text-slate-500" />
                    </div>
                  </div>
               </section>

               {/* DISTRIBUIÇÃO OPERACIONAL */}
               <section className="premium-card p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <PieChartIcon size={16} className="text-primary" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Distribuição da Carteira</h3>
                  </div>
                  <div className="space-y-6">
                    <StatusPillDashboard label="Vencidos" count={metrics.countVencido} total={metrics.activeTotal} color="bg-red-500" />
                    <StatusPillDashboard label="Hoje" count={metrics.countHoje} total={metrics.activeTotal} color="bg-blue-500" />
                    <StatusPillDashboard label="Atenção" count={metrics.countAtencao} total={metrics.activeTotal} color="bg-orange-500" />
                    <StatusPillDashboard label="Saudáveis" count={metrics.countSaudavel} total={metrics.activeTotal} color="bg-emerald-500" />
                    <StatusPillDashboard label="Sem Prazo" count={metrics.countSemPrazo} total={metrics.activeTotal} color="bg-slate-400" />
                    <div className="pt-4 border-t border-border/30">
                      <StatusPillDashboard label="Ativos Totais" count={metrics.activeTotal} total={metrics.totalRepo} color="bg-black" isTotalBase />
                    </div>
                  </div>
               </section>

               {/* GRÁFICO DE STATUS */}
               <section className="premium-card p-8 h-[380px] flex flex-col">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-10">Proporção de Ativos</h3>
                  <div className="flex-1 min-h-0">
                    {metrics.statusData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.statusData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                            {metrics.statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: '1px solid #e2e8f0', 
                              textTransform: 'uppercase', 
                              fontSize: '10px', 
                              fontWeight: '900', 
                              backgroundColor: '#ffffff', 
                              color: '#0a0a0a' 
                            }} 
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="h-full flex items-center justify-center text-[10px] font-black uppercase text-muted-foreground/30">Sem dados operacionais</p>
                    )}
                  </div>
               </section>

               {/* BOTÃO RELATÓRIO */}
               <section className="bg-primary text-primary-foreground p-8 rounded-2xl shadow-2xl space-y-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                    <Activity size={80} />
                  </div>
                  <div className="space-y-2 relative">
                    <h3 className="text-2xl font-black uppercase tracking-tight">Relatório Consolidado</h3>
                    <p className="text-[11px] font-bold uppercase tracking-widest leading-relaxed opacity-60">Gere agora o dossiê executivo completo com toda a telemetria do gabinete.</p>
                  </div>
                  <Button variant="outline" asChild className="w-full bg-background text-foreground border-none hover:bg-background/90 font-black h-14 uppercase text-[11px] tracking-widest transition-all rounded-xl shadow-lg relative">
                    <Link href="/report">Sincronizar & Gerar</Link>
                  </Button>
               </section>
            </div>
          </div>
        </div>
        <footer className="h-10 border-t border-border/50 bg-card/60 flex items-center justify-center gap-6 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.4em] shrink-0">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span>Advanced Monitoring • Davi Alves Figueredo</span>
        </footer>
      </main>
    </div>
  );
}

function DashboardKpiMini({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white border border-border/40 p-4 rounded-xl shadow-sm space-y-3">
       <div className={cn("w-6 h-6 rounded-md flex items-center justify-center bg-secondary/50", color)}>
          {icon}
       </div>
       <div className="space-y-0.5">
          <p className="text-xl font-black tabular-nums tracking-tighter">{value}</p>
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest truncate">{label}</p>
       </div>
    </div>
  );
}

function StatusPillDashboard({ label, count, total, color, isTotalBase = false }: { label: string; count: number; total: number; color: string; isTotalBase?: boolean; }) {
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
