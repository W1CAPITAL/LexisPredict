
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
  Calendar,
  Zap,
  TrendingDown,
  Sparkles,
  LayoutDashboard,
  Target,
  ArrowRight,
  History,
  Activity,
  AlertCircle
} from 'lucide-react';
import { LegalCase } from '@/lib/case-logic';
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

  useEffect(() => {
    setMounted(true);
    loadInsights();
    const handleStorageUpdate = () => loadInsights();
    window.addEventListener('lexis-insights-updated', handleStorageUpdate);
    return () => window.removeEventListener('lexis-insights-updated', handleStorageUpdate);
  }, [loadInsights]);

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
    if (mounted && cases.length === 0) loadData();
  }, [mounted, cases.length, loadData]);

  const metrics = useMemo(() => {
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
   
    const vencidos = ativos.filter(c => c.status === 'Vencido').length;
    const venceHoje = ativos.filter(c => c.status === 'É Hoje').length;
    const atencao = ativos.filter(c => c.status === 'Atenção').length;
    const noPrazo = ativos.filter(c => c.status === 'No Prazo').length;
    
    // Alertas DataJud
    const updatedInCourt = ativos.filter(c => c.tem_atualizacao_pos_retorno).length;
   
    const riskSum = (vencidos * 1.0) + (venceHoje * 0.8) + (atencao * 0.5) + (noPrazo * 0.1);
    const riskScore = activeTotal > 0 ? Math.min(100, Math.round((riskSum / activeTotal) * 100)) : 0;
    const pctHoje = activeTotal > 0 ? Math.round((venceHoje / activeTotal) * 100) : 0;
    const pctVencidos = activeTotal > 0 ? Math.round((vencidos / activeTotal) * 100) : 0;
    const pctAtencao = activeTotal > 0 ? Math.round((atencao / activeTotal) * 100) : 0;

    const statusData = [
      { name: t.statusCritico, value: vencidos, color: '#ef4444' },
      { name: t.statusHoje, value: venceHoje, color: '#3b82f6' },
      { name: t.statusAtencao, value: atencao, color: '#f97316' },
      { name: t.statusPrazo, value: noPrazo, color: '#10b981' }
    ].filter(d => d.value > 0);

    return { 
      activeTotal, vencidos, venceHoje, atencao, noPrazo, 
      riskScore, statusData, pctHoje, pctVencidos, pctAtencao,
      updatedInCourt
    };
  }, [cases, t]);

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
            {metrics.updatedInCourt > 0 && (
              <Badge variant="destructive" className="animate-pulse h-8 px-4 rounded-xl font-black uppercase text-[10px] flex items-center gap-2">
                <AlertCircle size={14} /> {metrics.updatedInCourt} Atualizações no Tribunal
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
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title={t.statusHoje} value={loading ? "..." : metrics.venceHoje} icon={<Clock />} color={metrics.venceHoje > 0 ? "warning" : "primary"} trend={`${metrics.pctHoje}%`} trendUp={false} />
            <StatCard title={t.statusVencido} value={loading ? "..." : metrics.vencidos} icon={<ShieldAlert />} color="destructive" trend={`${metrics.pctVencidos}%`} trendUp={false} />
            <StatCard title="Movimento Tribunal" value={loading ? "..." : metrics.updatedInCourt} icon={<Activity />} color={metrics.updatedInCourt > 0 ? "warning" : "success"} />
            <StatCard title={t.activeDemands} value={loading ? "..." : metrics.activeTotal} icon={<History />} color="accent" />
          </section>
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
            <div className="xl:col-span-8 space-y-8">
               {metrics.updatedInCourt > 0 && (
                 <section className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-amber-100 text-amber-600 flex items-center justify-center rounded-xl">
                          <Zap size={24} />
                       </div>
                       <div>
                          <h3 className="font-black uppercase text-sm">Alerta de Vigilância</h3>
                          <p className="text-[10px] font-bold uppercase text-amber-700/60">Identificamos {metrics.updatedInCourt} processos com novos andamentos judiciais após seu último retorno.</p>
                       </div>
                    </div>
                    <Button asChild variant="outline" className="border-amber-200 text-amber-700 font-black uppercase text-[10px] h-10 px-6 rounded-xl hover:bg-amber-100">
                       <Link href="/cases?filter=updated">Ver Atualizações</Link>
                    </Button>
                 </section>
               )}

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
               
               <section className="premium-card overflow-hidden">
                  <div className="px-8 py-6 border-b border-border/30 flex items-center justify-between bg-secondary/10">
                     <div className="flex items-center gap-3">
                       <Target size={18} className="text-red-500" />
                       <h3 className="text-[11px] font-black uppercase tracking-[0.25em]">{t.priorityQueue}</h3>
                     </div>
                     <Link href="/tarefas" className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors">
                       Ver Fila <ArrowRight size={14} />
                     </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-card border-b border-border/30">
                        <tr className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          <th className="px-8 py-4">Tribunal</th>
                          <th className="px-8 py-4">Titular</th>
                          <th className="px-8 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {cases
                          .filter(c => ['Vencido', 'É Hoje', 'Atenção'].includes(c.status) && !isCasoEncerrado(c))
                          .sort((a, b) => (a.diasFaltando || 0) - (b.diasFaltando || 0))
                          .slice(0, 8)
                          .map((c) => (
                            <tr key={c.id} className="hover:bg-secondary/20 transition-colors group">
                              <td className="px-8 py-5">
                                <Badge variant="outline" className="text-[9px] font-black uppercase border-border/50 rounded-lg h-7 px-3 bg-background">{c.tribunal}</Badge>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold uppercase text-[12px] text-foreground group-hover:text-primary transition-colors">{c.cliente}</span>
                                  <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{c.protocolo}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <span className={cn(
                                  "text-[10px] font-black uppercase px-3 py-1 rounded-full",
                                  c.status === 'Vencido' ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                                  c.status === 'É Hoje' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                                  "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                )}>
                                  {c.status}
                                </span>
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
               <section className="premium-card p-8 space-y-8">
                  <div className="flex justify-between items-end">
                     <div className="space-y-1">
                       <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t.riskIndex}</p>
                       <h4 className="text-5xl font-black tracking-tighter leading-none">{metrics.riskScore}%</h4>
                     </div>
                  </div>
                  <div className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                    <div className={cn("h-full transition-all duration-1000", metrics.riskScore > 60 ? "bg-red-500" : metrics.riskScore > 30 ? "bg-orange-500" : "bg-emerald-500")} style={{ width: `${metrics.riskScore}%` }} />
                  </div>
               </section>
               <section className="premium-card p-8 h-[440px] flex flex-col">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-10">Status da Carteira</h3>
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
