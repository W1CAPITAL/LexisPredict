/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * DOSSIÊ OPERACIONAL v7.0 — AUDITORIA DE BANCA E TOP 10 DE CRITICIDADE
 */
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
  Users,
  Loader2,
  Building2,
  Gavel,
  StickyNote,
  Globe,
  Target,
  UserCheck,
  ChevronRight,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
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
  Cell,
  Tooltip
} from 'recharts';
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { getSinalCapa } from "@/lib/sinal-capa";
import { calcularProbabilidadeEncerramento } from "@/lib/probabilidade-encerramento";
import { calcularScoreAdvogado } from "@/lib/score-engine";

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
           try { setIaInsights(JSON.parse(savedInsights)); } catch(e) {}
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
    
    // UNIFICAÇÃO DE NOVIDADES
    const countNovoAndamento = ativos.filter(c => !!c.tem_novo_andamento).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    // Top 10 Críticos por Movimentação Recente
    const topCriticos = ativos
      .filter(c => !!c.tem_novo_andamento)
      .map(c => ({ case: c, sinal: getSinalCapa(c) }))
      .sort((a, b) => b.sinal.prioridade - a.sinal.prioridade)
      .slice(0, 10);

    // Top 10 Chance de Encerramento
    const topChance = ativos
      .map(c => ({ case: c, prob: calcularProbabilidadeEncerramento({ status: c.status, situacao: c.situacao, observacao: c.observacao, diasVencidos: c.diasFaltando ? Math.abs(c.diasFaltando) : 0 }) }))
      .filter(i => i.prob < 100) // Ignorar o que já está tecnicamente fechado
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 10);

    // Ranking de Advogados (Top 3 e Bottom 3)
    const lawyerGroups: Record<string, LegalCase[]> = {};
    cases.forEach(c => {
      const name = (c.advogado || "NÃO ATRIBUÍDO").trim().toUpperCase();
      if (!lawyerGroups[name]) lawyerGroups[name] = [];
      lawyerGroups[name].push(c);
    });

    const lawyerRank = Object.entries(lawyerGroups).map(([name, lCases]) => {
      const result = calcularScoreAdvogado(lCases);
      return { name, score: result.score };
    }).sort((a, b) => b.score - a.score);

    const top3Lawyers = lawyerRank.slice(0, 3);
    const bottom3Lawyers = lawyerRank.length > 3 ? lawyerRank.slice(-3).reverse() : [];

    const isMaster = checkIfSuperAdmin(profile) || checkIfSupervisor(profile);

    // Auditoria Individual
    const myAtivos = cases.filter(c => c.created_by === profile?.auth_user_id && !isCasoEncerrado(c));
    const myVencidos = myAtivos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico');
    const myNovidades = myAtivos.filter(c => !!c.tem_novo_andamento);

    return {
      totalRepo,
      activeTotal,
      countVencido,
      countHoje,
      riskScore: activeTotal > 0 ? Math.min(100, Math.round(((countVencido * 1 + countHoje * 0.8) / activeTotal) * 100)) : 0,
      countNovoAndamento,
      countEncerradoTribunal,
      countBA,
      isMaster,
      myVencidos: myVencidos.slice(0, 10),
      myNovidades: myNovidades.slice(0, 10),
      topCriticos,
      topChance,
      top3Lawyers,
      bottom3Lawyers
    };
  }, [cases, profile]);

  const handleExportPDF = () => {
    document.title = `Dossie_LexisPredict_${new Date().toISOString().split('T')[0]}`;
    window.print();
  };

  if (!mounted || loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f2] space-y-6">
        <Loader2 className="w-12 h-12 text-black animate-spin" />
        <p className="font-black tracking-[0.4em] text-[10px] text-black uppercase">Consolidando Dossiê Authority...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2f2] text-black font-sans selection:bg-black/5">
      <style jsx global>{`
        @media print {
          body { background-color: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-root { margin: 0 !important; border: 0 !important; width: 100% !important; max-width: none !important; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          .print-hidden { display: none !important; }
          @page { size: A4; margin: 12mm 14mm; }
        }
      `}</style>

      {/* HEADER CONTROLE */}
      <div className="print-hidden sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="text-black/70 hover:text-black font-black tracking-widest text-[10px] uppercase rounded-none h-10 px-4">
              <Link href="/"><ArrowLeft size={14} className="mr-2" /> Voltar ao Gabinete</Link>
            </Button>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3 py-1">Enterprise v18.0</Badge>
          </div>
          <Button onClick={handleExportPDF} className="bg-black text-white font-black uppercase text-[10px] h-11 px-7 rounded-none shadow-[4px_4px_0px_#00D1FF] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <Printer size={14} className="mr-2" /> Gerar PDF / Imprimir
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <div className="bg-white border-2 border-black print:border-0 shadow-[12px_12px_0px_#000] print-root">
          
          {/* CAPA REPORT */}
          <header className="relative overflow-hidden border-b-2 border-black break-inside-avoid">
            <div className="px-10 pt-16 pb-12 flex justify-between items-end">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black flex items-center justify-center"><Layers size={20} className="text-white" /></div>
                  <span className="text-[10px] tracking-[0.4em] uppercase text-black font-black">LexisPredict • Elite Reporting</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-[0.85] text-black">
                  DOSSIÊ MASTER<br /><span className="text-black/30 uppercase">DA CARTEIRA</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-black/40">Consolidação Operacional de Mérito</p>
              </div>
              <div className="text-right space-y-3">
                <div className="text-[10px] font-black uppercase opacity-40">Emissão por</div>
                <p className="text-lg font-black uppercase tracking-tight leading-none">{profile?.nome}</p>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 border-2 border-green-600 text-green-700 text-[9px] font-black tracking-widest uppercase">
                  <ShieldCheck size={12} /> Auditado
                </div>
              </div>
            </div>
            <div className="bg-black text-white px-10 py-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="text-primary">Status: Auditoria Sincronizada</span>
            </div>
          </header>

          {/* TELEMETRIA GLOBAL */}
          <section className="p-10 bg-[#f8f9fb] border-b-2 border-black break-inside-avoid">
            <div className="mb-10 p-8 border-4 border-black bg-black text-white shadow-[10px_10px_0px_#00D1FF]">
               <h3 className="text-[11px] font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                  <Zap className="text-primary animate-pulse" size={16}/> Telemetria Unificada de Gabinete
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Sinais de Novidade</p>
                     <p className="text-4xl font-black tabular-nums">{metrics.countNovoAndamento}</p>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Baixas Reais</p>
                     <p className="text-4xl font-black tabular-nums text-emerald-400">{metrics.countEncerradoTribunal}</p>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Indícios B.A.</p>
                     <p className="text-4xl font-black tabular-nums text-red-500">{metrics.countBA}</p>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Risco Global</p>
                     <p className="text-4xl font-black tabular-nums text-orange-400">{metrics.riskScore}%</p>
                  </div>
               </div>
            </div>
          </section>

          {/* TOP 10 CRÍTICOS POR MOVIMENTAÇÃO */}
          <section className="p-10 border-b-2 border-black break-inside-avoid">
             <div className="flex items-center gap-3 mb-8 border-b-2 border-black/5 pb-2">
                <Target size={18} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest">Top 10: Criticidade por Movimentação</h3>
             </div>
             <div className="border-2 border-black">
                <table className="w-full text-left text-[9px] font-black uppercase">
                   <thead className="bg-black text-white">
                      <tr>
                         <th className="p-3">Cliente / CNJ</th>
                         <th className="p-3">Natureza do Sinal</th>
                         <th className="p-3 text-center">Fonte</th>
                         <th className="p-3 text-right">Data Evento</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y-2 divide-black/5">
                      {metrics.topCriticos.map((item, i) => (
                        <tr key={i} className="hover:bg-secondary/10">
                           <td className="p-3">
                              <p className="text-[10px]">{item.case.cliente}</p>
                              <p className="text-[8px] opacity-40 font-mono">{item.case.protocolo}</p>
                           </td>
                           <td className="p-3">
                              <p className={cn(item.sinal.prioridade >= 80 ? "text-red-600" : "text-black")}>{item.sinal.titulo}</p>
                              <p className="text-[8px] font-bold opacity-40 lowercase italic line-clamp-1">{item.sinal.detalhe}</p>
                           </td>
                           <td className="p-3 text-center">
                              <Badge variant="outline" className="text-[7px] font-black border-black/10 uppercase">
                                {item.sinal.fonte}
                              </Badge>
                           </td>
                           <td className="p-3 text-right opacity-60">
                             {item.sinal.data ? new Date(item.sinal.data).toLocaleDateString('pt-BR') : '---'}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>

          {/* TOP 10 CHANCE DE ENCERRAMENTO */}
          <section className="p-10 border-b-2 border-black break-inside-avoid">
             <div className="flex items-center gap-3 mb-8 border-b-2 border-black/5 pb-2">
                <TrendingUpIcon size={18} className="text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-widest">Top 10: Maior Chance de Encerramento</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.topChance.map((item, i) => (
                   <div key={i} className="p-4 border-2 border-black flex items-center justify-between group hover:bg-black transition-all">
                      <div className="min-w-0">
                         <p className="text-[10px] font-black uppercase truncate group-hover:text-white">{item.case.cliente}</p>
                         <p className="text-[8px] font-mono opacity-40 group-hover:text-white/40">{item.case.protocolo}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-xl font-black text-emerald-600 group-hover:text-primary">{item.prob}%</p>
                         <p className="text-[7px] font-black uppercase opacity-40 group-hover:text-white/40">Probability</p>
                      </div>
                   </div>
                ))}
             </div>
          </section>

          {/* RANKING DE BANCA (BEST & WORST) */}
          {metrics.isMaster && (
             <section className="p-10 border-b-2 border-black break-inside-avoid">
                <div className="flex items-center gap-3 mb-8 border-b-2 border-black/5 pb-2">
                   <Gavel size={18} className="text-primary" />
                   <h3 className="text-xs font-black uppercase tracking-widest">Governança de Banca: Performance de Advogados</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <p className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2">
                        <TrendingUpIcon size={12}/> Top 3 Efficiency (Líderes)
                      </p>
                      <div className="space-y-3">
                         {metrics.top3Lawyers.map((l, i) => (
                           <div key={i} className="p-4 bg-emerald-50/20 border-2 border-emerald-200 flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase">#{i+1} {l.name}</span>
                              <span className="text-lg font-black text-emerald-600">+{new Intl.NumberFormat('pt-BR').format(l.score)}</span>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-6">
                      <p className="text-[9px] font-black uppercase text-red-600 tracking-[0.2em] flex items-center gap-2">
                        <TrendingDownIcon size={12}/> Bottom 3 Performance (Revisão)
                      </p>
                      <div className="space-y-3">
                         {metrics.bottom3Lawyers.map((l, i) => (
                           <div key={i} className="p-4 bg-red-50/20 border-2 border-red-200 flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase">#{i+1} {l.name}</span>
                              <span className={cn("text-lg font-black", l.score < 0 ? "text-red-600" : "text-orange-600")}>
                                {new Intl.NumberFormat('pt-BR').format(l.score)}
                              </span>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
             </section>
          )}

          {/* BRIEFING NEURAL */}
          {iaInsights && (
             <section className="p-10 border-b-2 border-black bg-[#fafafa] break-inside-avoid">
                <div className="flex items-center gap-3 mb-8">
                   <Sparkles className="text-primary" size={18} />
                   <h3 className="text-xs font-black uppercase tracking-widest">Análise Neural Global</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><TrendingUp size={12}/> Vantagens Técnicas</p>
                      <p className="text-[10px] font-bold uppercase text-black/70 leading-relaxed italic">
                          "{iaInsights.pontosFortes?.[0] || "Monitoramento regular mantido."}"
                      </p>
                   </div>
                   <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-red-600 flex items-center gap-2"><TrendingDown size={12}/> Riscos Operacionais</p>
                      <p className="text-[10px] font-bold uppercase text-black/70 leading-relaxed italic">
                          "{iaInsights.riscosDetectados?.[0] || "Nenhum risco crítico identificado."}"
                      </p>
                   </div>
                </div>
             </section>
          )}

          <footer className="p-10 border-t-2 border-black flex justify-between items-center break-inside-avoid">
             <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-2 border-black flex items-center justify-center bg-black"><Zap size={14} className="text-white" /></div>
                <p className="text-[9px] tracking-[0.4em] uppercase text-black/40 font-black">2026 W1 CAPITAL • AUTHORITY SYSTEM</p>
             </div>
             <p className="text-[10px] font-black uppercase text-black/60">Copyright © 2026 LexisPredict Elite</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000] break-inside-avoid group hover:bg-black transition-all">
      <p className="text-[9px] font-black uppercase text-black/40 mb-2 group-hover:text-white/40 tracking-widest">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums group-hover:text-white transition-all", color)}>{value}</p>
    </div>
  );
}
