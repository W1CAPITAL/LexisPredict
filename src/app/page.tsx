"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { StatCard } from '@/components/dashboard/stat-card';
import { OfficeStats } from '@/components/dashboard/office-stats';
import { 
  ShieldAlert, RefreshCcw, FileDown, Copyright, TrendingUp, Clock, Zap, TrendingDown, Sparkles, LayoutDashboard, Target, ArrowRight, Activity, AlertCircle, AlertTriangle, Gavel, CheckCircle2, PieChart as PieChartIcon, Layers, Briefcase, History, ExternalLink, Cpu, Fingerprint, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { fetchRepoCases } from '@/app/actions/case-actions';
import { fetchMniStatsAction } from '@/app/actions/scanner-actions';
import Link from 'next/link';
import { getTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/use-app-store';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Dashboard() {
  const { cases, setCases, locale, sync, updateLastSync } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mniStats, setMniStats] = useState<any>(null);
  const [telemetrySource, setTelemetrySource] = useState<'datajud' | 'mni'>('mni');
  const t = getTranslation(locale);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [caseData, mniData] = await Promise.all([
        fetchRepoCases(),
        fetchMniStatsAction()
      ]);
      if (Array.isArray(caseData)) setCases(caseData);
      setMniStats(mniData);
      updateLastSync();
    } finally {
      setLoading(false);
    }
  }, [setCases, updateLastSync]);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [loadData]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-10 shrink-0 z-40">
          <div className="flex flex-col">
            <div className="flex items-center gap-3"><LayoutDashboard size={20} /><h1 className="font-black text-xl tracking-tight uppercase">{t.dashboard}</h1></div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Gabinete Estratégico • W1 Capital</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={telemetrySource} onValueChange={(val: any) => setTelemetrySource(val)}>
               <SelectTrigger className="w-[180px] h-9 text-[10px] font-black uppercase rounded-xl border-none bg-secondary/50">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent><SelectItem value="datajud">Fonte: DataJud</SelectItem><SelectItem value="mni">Fonte: Auditoria MNI</SelectItem></SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-xl"><RefreshCcw size={18} className={cn(loading && "animate-spin")} /></Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 space-y-10 max-w-[1600px] mx-auto w-full pb-32">
          {telemetrySource === 'mni' ? (
            <section className="bg-black text-white p-8 border-4 border-black shadow-[10px_10px_0px_#00D1FF] animate-in fade-in duration-500">
               <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] flex items-center gap-3"><ShieldCheck size={16} className="text-primary" /> Telemetria de Auditoria Inteligente</h3>
                  <Badge className="bg-primary text-black font-black uppercase text-[8px] rounded-none px-3">MNI Resolutivo v6.0</Badge>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                  <UtilityStat label="Localizados" value={mniStats?.localizados || 0} color="text-white" />
                  <UtilityStat label="Mudanças Detectadas" value={mniStats?.mudancasDetectadas || 0} color="text-primary" highlight />
                  <UtilityStat label="Possível Encerramento" value={mniStats?.possivelEncerramento || 0} color="text-emerald-400" highlight />
                  <UtilityStat label="Inércia +90 dias" value={mniStats?.parados90 || 0} color="text-orange-400" />
                  <UtilityStat label="Não Localizados" value={mniStats?.naoLocalizados || 0} color="text-red-500" />
               </div>
               <div className="mt-10 pt-6 border-t border-white/5 flex justify-between items-center">
                  <p className="text-[8px] font-bold uppercase text-white/20 tracking-widest">Base: Integridade de Hash & Cronologia Soberana</p>
                  <Button asChild variant="ghost" className="h-8 text-[9px] font-black text-primary hover:text-black hover:bg-primary uppercase tracking-widest">
                     <Link href="/scanner-monitor">Monitor de Auditoria <ArrowRight size={12} className="ml-2" /></Link>
                  </Button>
               </div>
            </section>
          ) : (
            <section className="bg-white border-4 border-black p-8 shadow-[10px_10px_0px_#000] animate-in fade-in duration-500">
               <div className="flex items-center justify-between mb-10 border-b border-black/10 pb-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] flex items-center gap-3"><Cpu size={16} /> Vigilância DataJud</h3>
                  <Badge variant="outline" className="border-black font-black uppercase text-[8px] rounded-none px-3">Vigilância Passiva</Badge>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-black">
                  <UtilityStatDark label="Novos Andamentos" value={cases.filter(c => !!c.tem_atualizacao_pos_retorno).length} color="text-blue-600" />
                  <UtilityStatDark label="Baixas no Tribunal" value={cases.filter(c => !!c.datajud_encerrado_tribunal).length} color="text-emerald-600" />
                  <UtilityStatDark label="Busca e Apreensão" value={cases.filter(c => !!c.indicio_busca_apreensao).length} color="text-red-600" />
               </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
             <StatCard title="Auditados" value={mniStats?.total || 0} icon={<Fingerprint />} color="primary" />
             <StatCard title="Estáveis" value={mniStats?.semAlteracao || 0} icon={<CheckCircle2 />} color="success" />
             <StatCard title="Mudanças" value={mniStats?.mudancasDetectadas || 0} icon={<Zap />} color="warning" />
             <StatCard title="Inércia Grave" value={mniStats?.parados180 || 0} icon={<Clock />} color="destructive" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-8">
               <OfficeStats cases={cases} />
            </div>
            <div className="xl:col-span-4">
               <Card className="premium-card p-8 bg-black text-white h-full border-none">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-8">Higiene da Carteira (Inércia)</h3>
                  <div className="space-y-6">
                    <StatusPillDashboard label="Ativos (Saudáveis)" count={mniStats?.semAlteracao || 0} total={mniStats?.total || 1} color="bg-emerald-500" />
                    <StatusPillDashboard label="Mudança Detectada" count={mniStats?.mudancasDetectadas || 0} total={mniStats?.total || 1} color="bg-blue-500" />
                    <StatusPillDashboard label="Parados +30 dias" count={mniStats?.parados30 || 0} total={mniStats?.total || 1} color="bg-orange-400" />
                    <StatusPillDashboard label="Parados +90 dias" count={mniStats?.parados90 || 0} total={mniStats?.total || 1} color="bg-orange-600" />
                    <StatusPillDashboard label="Parados +180 dias" count={mniStats?.parados180 || 0} total={mniStats?.total || 1} color="bg-red-600" />
                  </div>
               </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function UtilityStat({ label, value, color, highlight }: any) {
  return (
    <div className={cn("space-y-1 transition-opacity", highlight ? "opacity-100" : "opacity-60")}>
       <p className="text-[8px] font-black uppercase tracking-widest text-white/40">{label}</p>
       <p className={cn("text-3xl font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}

function UtilityStatDark({ label, value, color }: any) {
  return (
    <div className="space-y-1">
       <p className="text-[8px] font-black uppercase tracking-widest text-black/40">{label}</p>
       <p className={cn("text-3xl font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}

function StatusPillDashboard({ label, count, total, color }: { label: string; count: number; total: number; color: string; }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black tracking-wide text-white/40 uppercase">{label}</span>
        <span className="text-[10px] font-black tabular-nums">{count} <span className="text-[8px] opacity-30">({pct}%)</span></span>
      </div>
      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
