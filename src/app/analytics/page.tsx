"use client";
import { Dashboard as EfferdPanel } from "@/components/dashboard/efferd-dashboard-panel";


import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { 
  ShieldAlert, 
  Scale, 
  Users,
  FileDown,
  RefreshCcw,
  Copyright,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Gavel,
  Building2,
  Zap,
  TrendingDown
} from 'lucide-react';
import { LegalCase } from '@/lib/case-logic';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { LexisChartTooltip } from '@/components/charts/lexis-chart-tooltip';
import { isCasoEncerrado } from '@/lib/status-encerrado';

// CONSTANTES DE ESTILO PADRÃO LEXIS PREDICT - TODAS AS LETRAS EM PRETO
const TICK_DARK = { fill: 'currentColor', fontSize: 10, fontWeight: 700 };
const TOOLTIP_LIGHT = {
  backgroundColor: '#0f172a',
  borderRadius: '12px',
  border: '1px solid #334155',
  boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  color: '#f8fafc',
};
const TOOLTIP_ITEM = { color: '#f8fafc', fontWeight: 700 };
const TOOLTIP_LABEL = { color: '#e2e8f0', fontWeight: 900, fontSize: 10 };


export default function AnalyticsPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    async function load() {
      setLoading(true);
      try {
        const repoData = await fetchRepoCases();
        if (repoData) setCases(repoData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    const total = cases.length;
    if (total === 0) return null;

    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const totalAtivos = ativos.length;
    
    const statusCounts = {
      vencidos: cases.filter(c => c.status === 'Vencido' && !isCasoEncerrado(c)).length,
      hoje: cases.filter(c => c.status === 'É Hoje' && !isCasoEncerrado(c)).length,
      atencao: cases.filter(c => c.status === 'Atenção' && !isCasoEncerrado(c)).length,
      noPrazo: cases.filter(c => c.status === 'No Prazo' && !isCasoEncerrado(c)).length,
      finalizados: cases.filter(c => isCasoEncerrado(c)).length
    };

    const tribunalCounts: Record<string, number> = {};
    const lawyerCounts: Record<string, number> = {};
    const officeStats: Record<string, any> = {};

    cases.forEach(c => {
      const trib = c.tribunal || "Outros";
      tribunalCounts[trib] = (tribunalCounts[trib] || 0) + 1;

      const lawyer = c.advogado || "NÃO ATRIBUÍDO";
      lawyerCounts[lawyer] = (lawyerCounts[lawyer] || 0) + 1;

      const office = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      if (!officeStats[office]) {
        officeStats[office] = { name: office, total: 0, vencidos: 0, encerrados: 0, healthy: 0 };
      }
      officeStats[office].total++;
      if (isCasoEncerrado(c)) officeStats[office].encerrados++;
      else if (c.status === 'Vencido') officeStats[office].vencidos++;
      else officeStats[office].healthy++;
    });

    const topTribunals = Object.entries(tribunalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name: name.split(' - ')[0], count }));

    const topLawyers = Object.entries(lawyerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    const officePerformance = Object.values(officeStats).map(o => {
      const score = (o.encerrados * 15) + (o.healthy * 5) - (o.vencidos * 25);
      return { ...o, score };
    }).sort((a, b) => b.score - a.score);

    const pieData = [
      { name: 'Vencidos', value: statusCounts.vencidos, color: '#ef4444' },
      { name: 'Hoje', value: statusCounts.hoje, color: '#3b82f6' },
      { name: 'Atenção', value: statusCounts.atencao, color: '#f97316' },
      { name: 'No Prazo', value: statusCounts.noPrazo, color: '#10b981' },
    ].filter(d => d.value > 0);

    return { total, totalAtivos, statusCounts, topTribunals, topLawyers, officePerformance, pieData };
  }, [cases]);

  const handleExportPDF = () => {
    toast({ title: "Preparando Dossiê", description: "Otimizando visualização para exportação..." });
    setTimeout(() => window.print(), 500);
  };

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#f8f9fb] font-sans text-black">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-white/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-black text-white rounded-lg shadow-lg">
              <BarChart3 size={20} className="text-primary" />
            </div>
            <h1 className="font-black text-xl text-black uppercase tracking-tight">Business Intelligence</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="premium-card h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-wider border-none text-black">
              <FileDown size={14} className="mr-2" /> Exportar Dados
            </Button>
            <Button variant="ghost" size="icon" onClick={() => window.location.reload()} className="h-10 w-10 rounded-xl hover:bg-secondary">
              <RefreshCcw size={18} className={cn(loading && "animate-spin")} />
            </Button>
          </div>
        </header>
          

        <div className="flex-1 overflow-auto p-10 space-y-10 max-w-[1600px] mx-auto w-full pb-32">
          {/* TOP CARDS */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Total da Carteira" value={metrics?.total || 0} icon={<Users />} color="blue" />
            <MetricCard label="Processos Ativos" value={metrics?.totalAtivos || 0} icon={<ActivityIcon />} color="emerald" />
            <MetricCard label="Urgência Crítica" value={metrics?.statusCounts.vencidos || 0} icon={<ShieldAlert />} color="red" />
            <MetricCard label="Prazos para Hoje" value={metrics?.statusCounts.hoje || 0} icon={<Clock />} color="orange" />
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* OFFICE PERFORMANCE ANALYSIS - CONVERTIDO PARA LETRAS PRETAS */}
            <div className="xl:col-span-12 premium-card p-8 bg-white text-black min-h-[400px] flex flex-col relative overflow-hidden border-2 border-black">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                 <Building2 size={200} className="text-black" />
              </div>
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-black text-white rounded-lg">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-black">Ranking de Eficiência por Escritório</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Avaliação baseada em Resolutividade (Baixas) vs Inércia (Vencidos)</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-black text-black font-black uppercase text-[10px] px-4 py-1.5 rounded-none">Auditoria Neural Ativa</Badge>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative z-10">
                <div className="lg:col-span-1 space-y-4">
                  {metrics?.officePerformance.slice(0, 5).map((office, i) => (
                    <div key={office.name} className="flex items-center justify-between p-4 bg-[#f8f9fb] border border-black/10 hover:border-black transition-colors">
                      <div className="flex items-center gap-4">
                         <span className="text-black font-black text-lg">#{i+1}</span>
                         <div>
                            <p className="text-[11px] font-black uppercase truncate max-w-[150px] text-black">{office.name}</p>
                            <p className="text-[9px] font-bold text-black/40 uppercase">{office.total} Casos Totais</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={cn("text-lg font-black tracking-tighter", office.score > 0 ? "text-emerald-600" : "text-red-600")}>
                           {office.score > 0 ? `+${office.score}` : office.score}
                         </p>
                         <Badge variant="outline" className={cn(
                           "text-[7px] font-black uppercase px-1.5 py-0 border-black text-black",
                           office.score > 50 ? "bg-emerald-50" : office.score > 0 ? "bg-blue-50" : "bg-red-50"
                         )}>
                           {office.score > 50 ? 'ELITE' : office.score > 0 ? 'ESTÁVEL' : 'CRÍTICO'}
                         </Badge>
                      </div>
                    </div>
                  ))}
                  {(!metrics?.officePerformance || metrics.officePerformance.length === 0) && (
                    <p className="text-[10px] font-black uppercase text-black/20 text-center py-10">Sem dados para o período</p>
                  )}
                </div>

                <div className="lg:col-span-2 h-[300px]">
                  {metrics?.officePerformance && metrics.officePerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.officePerformance.slice(0, 8)}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK_DARK} />
                        <YAxis hide />
                        <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={40}>
                          {metrics.officePerformance.map((entry, index) => (
                            <Cell key={`cell-office-${index}`} fill={entry.score > 0 ? '#00D1FF' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-black/10 opacity-20">
                      <p className="text-[10px] font-black uppercase text-black">Gráfico de Performance indisponível</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TRIBUNAL ANALYSIS */}
            <div className="xl:col-span-8 premium-card p-8 bg-white min-h-[400px] flex flex-col border-none">
              <div className="flex items-center gap-3 mb-10">
                <Scale size={18} className="text-black/40" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40">Volumetria por Tribunal</h3>
              </div>
              <div className="flex-1 h-[300px]">
                {metrics?.topTribunals && metrics.topTribunals.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.topTribunals}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={TICK_DARK} />
                      <YAxis hide />
                      <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                        {metrics.topTribunals.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#000' : '#cbd5e1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="h-full flex items-center justify-center text-[10px] font-black uppercase text-black/30">Sem dados para o período</p>
                )}
              </div>
            </div>

            {/* STATUS DISTRIBUTION */}
            <div className="xl:col-span-4 premium-card p-8 bg-white h-[400px] flex flex-col border-none">
              <div className="flex items-center gap-3 mb-10">
                <PieChartIcon size={18} className="text-black/40" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40">Higiene da Carteira</h3>
              </div>
              <div className="flex-1 h-[250px]">
                {metrics?.pieData && metrics.pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.pieData}
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {metrics.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="h-full flex items-center justify-center text-[10px] font-black uppercase text-black/30">Sem dados para o período</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                {metrics?.pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-black uppercase text-black/60 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LAWYER PERFORMANCE */}
            <div className="xl:col-span-12 premium-card p-8 bg-white min-h-[400px] flex flex-col border-none">
              <div className="flex items-center gap-3 mb-10">
                <Gavel size={18} className="text-black/40" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-black/40">Distribuição por Advogado</h3>
              </div>
              <div className="flex-1 h-[350px]">
                {metrics?.topLawyers && metrics.topLawyers.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.topLawyers} layout="vertical" margin={{ left: 50, right: 30 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={TICK_DARK} 
                        width={150}
                      />
                      <Tooltip content={<LexisChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.2)" }} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={30}>
                        {metrics.topLawyers.map((entry, index) => (
                          <Cell key={`cell-lawyer-${index}`} fill={index === 0 ? '#00D1FF' : '#000'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="h-full flex items-center justify-center text-[10px] font-black uppercase text-black/30">Sem dados para o período</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="h-10 border-t border-border/50 bg-white flex items-center justify-center gap-6 text-[10px] text-black/40 font-black uppercase tracking-[0.2em] shrink-0 print:hidden">
          <div className="flex items-center gap-2"><Copyright size={10} /> 2026 W1 Capital.</div>
          <span className="text-black">Relatório Analítico • FUNDADOR DAVI ALVES FIGUEREDO</span>
        </footer>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  const styles: Record<string, string> = {
    blue: "text-black bg-blue-50 border-blue-100",
    emerald: "text-black bg-emerald-50 border-emerald-100",
    red: "text-black bg-red-50 border-red-100",
    orange: "text-black bg-orange-50 border-orange-100"
  };

  return (
    <div className="premium-card p-6 flex flex-col justify-between group hover:border-black transition-all bg-white border-2 border-transparent">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-black/40 uppercase tracking-widest">{label}</p>
          <h3 className="text-3xl font-black tracking-tighter text-black tabular-nums">{value}</h3>
        </div>
        <div className={cn("p-2.5 rounded-lg border transition-colors", styles[color])}>
          {React.cloneElement(icon as React.ReactElement<any>, { size: 18, className: "text-black" })}
        </div>
      </div>
    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}