"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LegalCase, CaseNote } from "@/lib/case-logic";
import { Button } from "@/components/ui/button";
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  Activity,
  Copyright,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Scale,
  Zap,
  TrendingUp,
  Sparkles,
  TrendingDown,
  Layers,
  Search,
  Users,
  Loader2,
  Building2,
  Gavel,
  StickyNote,
  Image as ImageIcon,
  Globe
} from "lucide-react";
import Link from "next/link";
import { fetchRepoCases, fetchRepoNotes } from "@/app/actions/case-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/use-app-store";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell
} from 'recharts';
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { ChanceEncerramentoCard } from '@/components/dashboard/chance-encerramento-card';
import { analisarChanceEncerramento } from '@/lib/chance-encerramento-logic';
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";

export default function UnifiedReport() {
  const { setCases } = useAppStore();
  const [cases, setLocalCases] = useState<LegalCase[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const [casesData, notesData] = await Promise.all([
          fetchRepoCases(),
          fetchRepoNotes()
        ]);
        setLocalCases(casesData || []);
        setCases(casesData || []);
        setNotes(notesData || []);
        
        const savedInsights = localStorage.getItem('lexisPredict_notes_analysis');
        if (savedInsights) {
           try {
             setIaInsights(JSON.parse(savedInsights));
           } catch(e) {}
        }
      } catch (e) {
        console.error("Report extraction failure:", e);
      } finally {
        setLoading(false);
      }
    }
    if (mounted && !authLoading) load();
  }, [mounted, authLoading, setCases]);

  const metrics = useMemo(() => {
    const totalRepo = cases.length;
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
    
    const countVencido = ativos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => c.status === 'É Hoje').length;
    const countAtencao = ativos.filter(c => c.status === 'Atenção').length;
    
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    
    // MÉTRICAS DJEN v2.0
    const countDjenNovo = ativos.filter(c => !!c.djen_nova_comunicacao).length;
    const countDjenAuditado = cases.filter(c => !!c.djen_consultado_em).length;

    const rateAndamento = activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;
    const rateDjen = activeTotal > 0 ? Math.round((countDjenNovo / activeTotal) * 100) : 0;

    const riskScore = activeTotal > 0 ? Math.min(100, Math.round(((countVencido * 1 + countHoje * 0.8) / activeTotal) * 100)) : 0;

    const tribCounts: Record<string, number> = {};
    cases.forEach(c => {
      const name = c.tribunal || 'Outros';
      tribCounts[name] = (tribCounts[name] || 0) + 1;
    });

    const chartData = Object.entries(tribCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.split(' - ')[0], count }));

    const isMaster = checkIfSuperAdmin(profile) || checkIfSupervisor(profile);

    return {
      totalRepo, 
      activeTotal, 
      countVencido, 
      countHoje, 
      countAtencao, 
      riskScore, 
      chartData,
      countNovoAndamento, rateAndamento,
      countDjenNovo, rateDjen, countDjenAuditado,
      isMaster
    };
  }, [cases, profile]);

  const handleExportPDF = () => window.print();

  if (!mounted || loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f2] space-y-6">
        <Loader2 className="w-12 h-12 text-black animate-spin" />
        <p className="font-black tracking-[0.4em] text-[10px] text-black uppercase">Sincronizando Dossiê Estratégico...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2f2] text-black font-sans selection:bg-black/5">
      <style jsx global>{`
        @media print {
          body { background-color: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { box-shadow: none !important; }
          .break-avoid { break-inside: avoid; page-break-inside: avoid; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="print:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="text-black/70 hover:text-black hover:bg-black/5 font-black tracking-widest text-[10px] uppercase rounded-none h-10 px-4">
              <Link href="/"><ArrowLeft size={14} className="mr-2" /> Voltar ao Gabinete</Link>
            </Button>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3 py-1">Unified Audit v6.0</Badge>
          </div>
          <Button onClick={handleExportPDF} className="bg-black text-white font-black uppercase text-[10px] h-11 px-7 rounded-none shadow-[4px_4px_0px_#00D1FF]">
            <Printer size={14} className="mr-2" /> Imprimir Dossiê
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <div className="bg-white border-2 border-black print:border-0 shadow-[12px_12px_0px_#000]">
          <header className="relative overflow-hidden border-b-2 border-black">
            <div className="px-10 pt-12 pb-10 flex justify-between items-end">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-black flex items-center justify-center"><Layers size={16} className="text-white" /></div>
                  <span className="text-[10px] tracking-[0.35em] uppercase text-black font-black">LexisPredict • Master Report</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9]">DOSSIÊ DE<br /><span className="text-black/40">INFRAESTRUTURA</span></h1>
              </div>
              <div className="text-right">
                <p className="text-sm font-black uppercase">{profile?.nome}</p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 border-2 border-green-600 text-green-600 text-[9px] font-black tracking-widest uppercase">Auditado</div>
              </div>
            </div>
          </header>

          <section className="px-10 py-10 bg-[#f8f9fb]">
             <div className="mb-10 p-8 border-4 border-black bg-black text-white shadow-[10px_10px_0px_#00D1FF] break-avoid">
                <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Zap className="text-primary" size={14}/> Vigilância Unificada (Audit 3D)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Movimentos Tribunal</p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black">{metrics.countNovoAndamento}</span>
                         <span className="text-sm font-black text-primary">({metrics.rateAndamento}%)</span>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Publicações DJEN</p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black">{metrics.countDjenNovo}</span>
                         <span className="text-sm font-black text-blue-400">({metrics.rateDjen}%)</span>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Janela de Auditoria</p>
                      <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black">{metrics.countDjenAuditado}</span>
                         <span className="text-[9px] font-black text-white/40 ml-1">ITENS VERIFICADOS</span>
                      </div>
                   </div>
                </div>
             </div>

            <div className="grid grid-cols-3 gap-6">
               <KpiCard label="Ativos" value={metrics.activeTotal} accent="text-blue-600" />
               <KpiCard label="Vencidos" value={metrics.countVencido} accent="text-red-600" />
               <KpiCard label="Risco" value={`${metrics.riskScore}%`} accent="text-orange-600" />
            </div>
          </section>

          <section className="p-10 border-t-2 border-black break-avoid">
            <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60 mb-8 flex items-center gap-2"><Globe size={14}/> Parecer de Diário Oficial (DJEN)</h2>
            <div className="p-8 bg-gray-50 border-2 border-black space-y-4">
              <p className="text-[11px] font-bold uppercase leading-relaxed text-black/80">
                A vigilância de diário oficial identificou {metrics.countDjenNovo} publicações relevantes após o último contato com os clientes. Recomenda-se a triagem imediata via módulo de Notificações para evitar preclusões.
              </p>
            </div>
          </section>

          <footer className="px-10 py-10 border-t-2 border-black flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border-2 border-black flex items-center justify-center bg-black"><Zap size={16} className="text-white" /></div>
              <p className="text-[10px] tracking-[0.35em] uppercase text-black/40 font-black">2026 W1 Capital • Authority System</p>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-black/60">Relatório Selado por Davi Alves Figueredo</div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: any; accent: string }) {
  return (
    <div className="bg-white border-2 border-black p-6 shadow-[6px_6px_0px_#000] break-avoid">
      <p className="text-[9px] font-black uppercase text-black/40 mb-2">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums", accent)}>{value}</p>
    </div>
  );
}
