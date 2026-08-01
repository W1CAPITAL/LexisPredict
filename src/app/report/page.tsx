/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * DOSSIÊ OPERACIONAL v6.0 - SELAGEM PDF ANTI-CORTE
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
  Cell,
  Tooltip
} from 'recharts';
import { isCasoEncerrado } from "@/lib/status-encerrado";
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
    const countSaudavel = ativos.filter(c => c.status === 'No Prazo').length;
    const countSemPrazo = ativos.filter(c => c.status === 'Sem Prazo').length;
   
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    // MÉTRICAS DJEN
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

    // Estatísticas por Escritório e Advogado
    const offices: Record<string, any> = {};
    const lawyers: Record<string, any> = {};

    cases.forEach(c => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      const lawyerName = (c.advogado || "NÃO ATRIBUÍDO").trim().toUpperCase();
      const isAtivo = !isCasoEncerrado(c);

      if (!offices[officeName]) offices[officeName] = { name: officeName, total: 0, ativos: 0, vencidos: 0, hoje: 0 };
      if (!lawyers[lawyerName]) lawyers[lawyerName] = { name: lawyerName, total: 0, ativos: 0, vencidos: 0, hoje: 0 };

      offices[officeName].total++;
      lawyers[lawyerName].total++;

      if (isAtivo) {
        offices[officeName].ativos++;
        lawyers[lawyerName].ativos++;
        if (c.status === 'Vencido' || c.status === 'Caso Crítico') { offices[officeName].vencidos++; lawyers[lawyerName].vencidos++; }
        if (c.status === 'É Hoje') { offices[officeName].hoje++; lawyers[lawyerName].hoje++; }
      }
    });

    const sortedOffices = Object.values(offices).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total);
    const sortedLawyers = Object.values(lawyers).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total);

    const isMaster = checkIfSuperAdmin(profile) || checkIfSupervisor(profile);

    return {
      totalRepo,
      activeTotal,
      countVencido,
      countHoje,
      countAtencao,
      countSaudavel,
      countSemPrazo,
      riskScore,
      chartData,
      countNovoAndamento,
      rateAndamento,
      countEncerradoTribunal,
      countBA,
      countDjenNovo,
      rateDjen,
      countDjenAuditado,
      sortedOffices,
      sortedLawyers,
      isMaster
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
        <p className="font-black tracking-[0.4em] text-[10px] text-black uppercase">Sincronizando Dossiê Estratégico...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2f2] text-black font-sans selection:bg-black/5">
      <style jsx global>{`
        @media print {
          body { background-color: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { box-shadow: none !important; text-shadow: none !important; }
          .print-root { margin: 0 !important; border: 0 !important; width: 100% !important; max-width: none !important; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
          .print-hidden { display: none !important; }
          @page { size: A4; margin: 12mm 14mm; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>

      {/* HEADER CONTROLE */}
      <div className="print-hidden sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="text-black/70 hover:text-black font-black tracking-widest text-[10px] uppercase rounded-none h-10 px-4">
              <Link href="/"><ArrowLeft size={14} className="mr-2" /> Voltar ao Gabinete</Link>
            </Button>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3 py-1">Authority v6.0</Badge>
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
                  DOSSIÊ OPERACIONAL<br /><span className="text-black/30 uppercase">DA CARTEIRA</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-black/40">Sincronia Global • Protocolo W1 Capital</p>
              </div>
              <div className="text-right space-y-3">
                <div className="text-[10px] font-black uppercase opacity-40">Operador Responsável</div>
                <p className="text-lg font-black uppercase tracking-tight leading-none">{profile?.nome}</p>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 border-2 border-green-600 text-green-700 text-[9px] font-black tracking-widest uppercase">
                  <ShieldCheck size={12} /> Auditado
                </div>
              </div>
            </div>
            <div className="bg-black text-white px-10 py-3 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span className="text-primary">Status: Concluído</span>
            </div>
          </header>

          {/* TELEMETRIA FORENSE 4D */}
          <section className="p-10 bg-[#f8f9fb] border-b-2 border-black break-inside-avoid">
            <div className="mb-10 p-8 border-4 border-black bg-black text-white shadow-[10px_10px_0px_#00D1FF]">
               <h3 className="text-[11px] font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                  <Zap className="text-primary animate-pulse" size={16}/> Vigilância Unificada (Audit 3D)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Movimentos Tribunal</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tabular-nums">{metrics.countNovoAndamento}</span>
                        <span className="text-xs font-black text-primary">({metrics.rateAndamento}%)</span>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Baixas Detectadas</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tabular-nums text-emerald-400">{metrics.countEncerradoTribunal}</span>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">Indícios B.A.</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tabular-nums text-red-500">{metrics.countBA}</span>
                        <Badge className="bg-red-500/10 text-red-500 border-none text-[8px] uppercase">Risco</Badge>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase opacity-60">DJEN Pendentes</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tabular-nums text-blue-400">{metrics.countDjenNovo}</span>
                        <span className="text-xs font-black text-blue-400/60">({metrics.rateDjen}%)</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
               <KpiCard label="Ativos" value={metrics.activeTotal} color="text-black" />
               <KpiCard label="Vencidos" value={metrics.countVencido} color="text-red-600" />
               <KpiCard label="É Hoje" value={metrics.countHoje} color="text-blue-600" />
               <KpiCard label="No Prazo" value={metrics.countSaudavel} color="text-emerald-600" />
               <KpiCard label="Sem Prazo" value={metrics.countSemPrazo} color="text-slate-400" />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
             {/* COLUNA ESQUERDA: GRÁFICOS E BI */}
             <div className="md:col-span-8 p-10 border-r-2 border-black space-y-16">
                
                {/* ÍNDICE DE RISCO */}
                <section className="space-y-8 break-inside-avoid">
                   <div className="flex items-center justify-between border-b-2 border-black/5 pb-4">
                      <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Activity size={16} /> Índice de Risco Operacional</h3>
                      <span className="text-3xl font-black tabular-nums">{metrics.riskScore}%</span>
                   </div>
                   <div className="h-10 w-full bg-slate-100 border-2 border-black relative overflow-hidden">
                      <div className="h-full bg-black transition-all duration-1000" style={{ width: `${metrics.riskScore}%` }} />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase mix-blend-difference text-white">Consolidação de Preclusão</div>
                   </div>
                   <p className="text-[10px] font-bold text-black/60 uppercase leading-relaxed text-justify">
                      O índice de risco é calculado ponderando os prazos vencidos e demandas do dia em relação ao volume total da carteira. Um score acima de 40% exige intervenção imediata da coordenação jurídica.
                   </p>
                </section>

                {/* VOLUMETRIA TRIBUNAL */}
                <section className="space-y-8 break-inside-avoid">
                   <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Building2 size={16} /> Volumetria por Tribunal</h3>
                   
                   {/* GRÁFICO EM TELA */}
                   <div className="h-64 w-full print:hidden">
                      <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={metrics.chartData}>
                            <XAxis dataKey="name" fontSize={9} fontWeight={900} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip cursor={{fill: '#f8f9fb'}} contentStyle={{ borderRadius: '0', border: '2px solid black', fontSize: '10px', fontWeight: '900' }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={35}>
                               {metrics.chartData.map((_, index) => (
                                  <Cell key={index} fill={index === 0 ? '#000' : '#00D1FF'} />
                               ))}
                            </Bar>
                         </BarChart>
                      </ResponsiveContainer>
                   </div>

                   {/* TABELA EM PRINT (SUBSTITUI GRÁFICO) */}
                   <div className="hidden print:block border-2 border-black">
                      <table className="w-full text-left">
                         <thead className="bg-black text-white text-[9px] font-black uppercase">
                            <tr>
                               <th className="p-3">Tribunal</th>
                               <th className="p-3 text-right">Processos</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-black/10">
                            {metrics.chartData.map((d, i) => (
                               <tr key={i} className="text-[10px] font-black uppercase">
                                  <td className="p-3">{d.name}</td>
                                  <td className="p-3 text-right">{d.count}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </section>

                {/* RANKING ESCRITÓRIOS */}
                <section className="space-y-6 break-inside-avoid">
                   <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Target size={16} /> Performance por Escritório</h3>
                   <div className="border-2 border-black overflow-hidden">
                      <table className="w-full text-left">
                         <thead className="bg-black text-white text-[9px] font-black uppercase">
                            <tr>
                               <th className="p-3">Unidade</th>
                               <th className="p-3 text-center">Ativos</th>
                               <th className="p-3 text-center text-red-400">Vencidos</th>
                               <th className="p-3 text-right">Total</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y-2 divide-black/5">
                            {metrics.sortedOffices.map((off, i) => (
                               <tr key={i} className="text-[10px] font-black uppercase hover:bg-gray-50">
                                  <td className="p-3">{off.name}</td>
                                  <td className="p-3 text-center">{off.ativos}</td>
                                  <td className={cn("p-3 text-center", off.vencidos > 0 && "text-red-600 bg-red-50")}>{off.vencidos}</td>
                                  <td className="p-3 text-right opacity-40">{off.total}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </section>
             </div>

             {/* COLUNA DIREITA: INSIGHTS E NOTAS */}
             <div className="md:col-span-4 bg-[#fafafa] flex flex-col">
                
                {/* BRIEFING NEURAL */}
                {iaInsights && (
                   <div className="p-10 border-b-2 border-black space-y-8 break-inside-avoid">
                      <div className="flex items-center gap-3">
                         <Sparkles className="text-primary" size={18} />
                         <h3 className="text-[11px] font-black uppercase tracking-widest">Briefing da Unidade Neural</h3>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-emerald-600 flex items-center gap-2"><TrendingUp size={12}/> Vantagens Técnicas</p>
                            <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic">
                               "{iaInsights.pontosFortes?.[0] || "Monitoramento de rotina mantido."}"
                            </p>
                         </div>
                         <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-red-600 flex items-center gap-2"><TrendingDown size={12}/> Riscos Detectados</p>
                            <p className="text-[11px] font-bold uppercase text-black/70 leading-relaxed italic">
                               "{iaInsights.riscosDetectados?.[0] || "Nenhum risco operacional identificado."}"
                            </p>
                         </div>
                      </div>
                   </div>
                )}

                {/* LIVRO DE EVIDÊNCIAS (NOTAS) */}
                <div className="p-10 space-y-8 flex-1">
                   <div className="flex items-center gap-3">
                      <StickyNote className="text-black/40" size={18} />
                      <h3 className="text-[11px] font-black uppercase tracking-widest">Memória do Gabinete</h3>
                   </div>
                   <div className="space-y-8">
                      {notes.slice(0, 8).map((n) => (
                         <div key={n.id} className="space-y-2 border-b border-black/5 pb-6 break-inside-avoid">
                            <div className="flex justify-between items-center">
                               <p className="text-[10px] font-black uppercase tracking-tight">{n.title}</p>
                               <span className="text-[8px] font-bold text-black/30">{n.updatedAt.split(',')[0]}</span>
                            </div>
                            <p className="text-[10px] font-bold uppercase text-black/60 leading-relaxed text-justify line-clamp-4">
                               {n.content}
                            </p>
                         </div>
                      ))}
                      {notes.length === 0 && <p className="text-[9px] font-black uppercase opacity-20 text-center py-10">Sem evidências recentes.</p>}
                   </div>
                </div>

                {/* PARECER DJEN */}
                <div className="p-10 bg-black text-white space-y-6 break-inside-avoid">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-primary"><Globe size={14}/> Parecer DJEN</h3>
                   <p className="text-[10px] font-bold uppercase leading-relaxed text-white/60">
                      A vigilância identificou {metrics.countDjenNovo} publicações oficiais relevantes no último ciclo de 24 horas. Itens encontram-se em fila para triagem e baixa no Centro de Alertas.
                   </p>
                </div>
             </div>
          </div>

          {/* FOOTER MASTER */}
          <footer className="p-10 border-t-2 border-black flex flex-col md:flex-row justify-between items-center gap-6 break-inside-avoid">
             <div className="flex items-center gap-10">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 border-2 border-black flex items-center justify-center bg-black"><Zap size={14} className="text-white" /></div>
                   <p className="text-[9px] tracking-[0.4em] uppercase text-black/40 font-black">2026 W1 CAPITAL • AUTHORITY SYSTEM</p>
                </div>
                <div className="hidden md:flex items-center gap-2">
                   <ShieldCheck size={16} className="text-emerald-600" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-black/40">Integridade de Dados Garantida</span>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/60">Relatório Selado Digitalmente</p>
                <div className="flex items-center justify-end gap-2 mt-1 font-black text-xs uppercase">
                   <Copyright size={12} /> 2026 LexisPredict Elite
                </div>
             </div>
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
