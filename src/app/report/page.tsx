
"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */

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
  Layers,
  Search,
  Users,
  Loader2,
  Building2,
  Gavel,
  Cpu,
  History,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { fetchRepoCases, fetchRepoNotes } from "@/app/actions/case-actions";
import { fetchMniStatsAction } from "@/app/actions/scanner-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/use-app-store";
import { useSearchParams } from "next/navigation";
import { isCasoEncerrado } from "@/lib/status-encerrado";

export default function UnifiedReport() {
  const { setCases } = useAppStore();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get('source');
  
  const [cases, setLocalCases] = useState<LegalCase[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [mniStats, setMniStats] = useState<any>(null);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const [casesData, notesData, mniData] = await Promise.all([
          fetchRepoCases(),
          fetchRepoNotes(),
          fetchMniStatsAction()
        ]);
        setLocalCases(casesData || []);
        setCases(casesData || []);
        setNotes(notesData || []);
        setMniStats(mniData);
        
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
    
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    const riskScore = activeTotal > 0 ? Math.min(100, Math.round(((countVencido * 1.0 + countHoje * 0.8) / activeTotal) * 100)) : 0;

    const criticalList = [...ativos]
      .sort((a, b) => {
        if (!!a.indicio_busca_apreensao !== !!b.indicio_busca_apreensao) return a.indicio_busca_apreensao ? -1 : 1;
        if (!!a.datajud_encerrado_tribunal !== !!b.datajud_encerrado_tribunal) return a.datajud_encerrado_tribunal ? -1 : 1;
        return (a.diasFaltando || 0) - (b.diasFaltando || 0);
      })
      .slice(0, 10);

    return {
      totalRepo, activeTotal, countVencido, countHoje, countAtencao, countSaudavel, countSemPrazo,
      riskScore, countNovoAndamento, countEncerradoTribunal, countBA, criticalList,
      rateAndamento: activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0,
      rateEncerrado: activeTotal > 0 ? Math.round((countEncerradoTribunal / activeTotal) * 100) : 0,
      rateBA: activeTotal > 0 ? Math.round((countBA / activeTotal) * 100) : 0
    };
  }, [cases]);

  if (!mounted || loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f2] space-y-6">
        <Loader2 className="w-12 h-12 text-black animate-spin" />
        <p className="font-black tracking-[0.4em] text-[10px] text-black uppercase">Sincronizando Dossiê Estratégico...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f2f2] text-black font-sans print:bg-white">
      <div className="print:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="font-black tracking-widest text-[10px] uppercase rounded-none h-10">
              <Link href="/"><ArrowLeft size={14} className="mr-2" /> Voltar ao Gabinete</Link>
            </Button>
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3">Omni-Report v2.0</Badge>
          </div>
          <Button onClick={() => window.print()} className="bg-black text-white font-black uppercase text-[10px] h-11 px-7 rounded-none shadow-[4px_4px_0px_#00D1FF]">
            <Printer size={14} className="mr-2" /> Imprimir Relatório
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 print:px-0 print:py-0">
        <div className="bg-white border-2 border-black shadow-[12px_12px_0px_#000] print:shadow-none print:border-0">
          {/* CABEÇALHO */}
          <header className="px-10 pt-12 pb-10 border-b-2 border-black">
            <div className="flex flex-col lg:flex-row justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-black flex items-center justify-center"><Layers size={16} className="text-primary" /></div>
                  <span className="text-[10px] tracking-[0.3em] uppercase font-black">W1 Capital • Advanced Legal Ops</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter leading-none uppercase">Dossiê de Infraestrutura</h1>
                <p className="text-xs font-bold uppercase tracking-[0.4em] opacity-40">Relatório Consolidado de Gabinete</p>
              </div>
              <div className="text-right flex flex-col justify-end space-y-1">
                <p className="text-sm font-black uppercase">{profile?.nome || "DIRETORIA"}</p>
                <p className="text-[9px] font-bold uppercase opacity-40">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </header>

          <div className="p-10 space-y-16">
            {/* SEÇÃO 1: TELEMETRIA DUAL */}
            <section className="space-y-8">
               <SectionTitle icon={Cpu} title="Telemetria de Auditoria (DataJud & MNI)" />
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <TelemetryCard label="Novos Andamentos" value={metrics.countNovoAndamento} sub={`${metrics.rateAndamento}% da carteira`} color="text-blue-600" />
                  <TelemetryCard label="Baixas no Tribunal" value={metrics.countEncerradoTribunal} sub={`${metrics.rateEncerrado}% de resolutividade`} color="text-emerald-600" />
                  <TelemetryCard label="Busca e Apreensão" value={metrics.countBA} sub={`${metrics.rateBA}% de risco possessório`} color="text-red-600" />
               </div>
               {mniStats && (
                 <div className="p-8 bg-black text-white grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <MiniStat label="Sem Novidade" value={mniStats.semAndamento} />
                    <MiniStat label="Novos Mov." value={mniStats.novoAndamento} color="text-primary" />
                    <MiniStat label="Encerrados" value={mniStats.encerrados} color="text-emerald-400" />
                    <MiniStat label="Em Recurso" value={mniStats.emRecurso} />
                    <MiniStat label="Petições" value={mniStats.peticao} />
                    <MiniStat label="Publicações" value={mniStats.publicacao} />
                    <MiniStat label="Com Prazo" value={mniStats.comPrazo} color="text-red-400" />
                 </div>
               )}
            </section>

            {/* SEÇÃO 2: DOSSIÊ OPERACIONAL */}
            <section className="space-y-8">
               <SectionTitle icon={Layers} title="Dossiê Operacional de Ativos" />
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <KpiReportCard label="Ativos em Gestão" value={metrics.activeTotal} icon={<Activity size={14}/>} />
                  <KpiReportCard label="Processos Vencidos" value={metrics.countVencido} icon={<AlertTriangle size={14}/>} color="text-red-600" />
                  <KpiReportCard label="Casos Saudáveis" value={metrics.countSaudavel} icon={<CheckCircle2 size={14}/>} color="text-emerald-600" />
                  <KpiReportCard label="Vencem Hoje" value={metrics.countHoje} icon={<Clock size={14}/>} color="text-orange-600" />
               </div>
            </section>

            {/* SEÇÃO 3: AUDITORIA NEURAL DE EVIDÊNCIAS */}
            {iaInsights && (
              <section className="space-y-8">
                 <SectionTitle icon={Sparkles} title="Auditoria Neural de Evidências (Notes)" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                         <TrendingUp size={14} /> Vantagens Estratégicas Detectadas
                       </h4>
                       <div className="space-y-4">
                          {iaInsights.pontosFortes?.map((p: string, i: number) => (
                            <div key={i} className="p-4 border-2 border-emerald-100 bg-emerald-50/20 flex gap-3">
                               <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                               <p className="text-[11px] font-bold uppercase leading-tight">{p}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                         <AlertTriangle size={14} /> Riscos Operacionais Mapeados
                       </h4>
                       <div className="space-y-4">
                          {iaInsights.riscosDetectados?.map((r: string, i: number) => (
                            <div key={i} className="p-4 border-2 border-red-100 bg-red-50/20 flex gap-3">
                               <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                               <p className="text-[11px] font-bold uppercase leading-tight">{r}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </section>
            )}

            {/* SEÇÃO 4: PROCESSOS DE URGÊNCIA MÁXIMA */}
            <section className="space-y-8">
               <SectionTitle icon={ShieldAlert} title="Top 10: Casos de Urgência Máxima" />
               <div className="border-4 border-black overflow-hidden">
                  <table className="w-full text-left">
                     <thead className="bg-black text-white">
                        <tr className="text-[9px] font-black uppercase tracking-widest">
                           <th className="p-4">Identificação / Cliente</th>
                           <th className="p-4">Protocolo / Tribunal</th>
                           <th className="p-4">Status Interno</th>
                           <th className="p-4 text-right">Prioridade</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 divide-black/5">
                        {metrics.criticalList.map((c, i) => (
                          <tr key={i} className="text-[10px] font-bold uppercase">
                             <td className="p-4">{c.cliente}</td>
                             <td className="p-4 font-mono text-[9px] opacity-60">{c.protocolo} ({c.tribunal})</td>
                             <td className="p-4">
                                <span className={cn("px-2 py-0.5 border-2", c.status === 'Vencido' ? "border-red-600 text-red-600" : "border-black")}>
                                  {c.status}
                                </span>
                             </td>
                             <td className="p-4 text-right">
                                {c.indicio_busca_apreensao ? <Badge className="bg-red-600 text-white rounded-none">BUSCA E APREENSÃO</Badge> : 
                                 c.datajud_encerrado_tribunal ? <Badge className="bg-black text-white rounded-none">ENCERRADO</Badge> :
                                 <span className="opacity-40">ALTA</span>}
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>
          </div>

          {/* RODAPÉ MASTER */}
          <footer className="p-10 border-t-4 border-black flex flex-col items-center space-y-6">
             <div className="flex items-center gap-10">
                <div className="flex items-center gap-2"><ShieldCheck size={20} className="text-primary"/><span className="text-[10px] font-black uppercase tracking-widest">Integridade Garantida</span></div>
                <div className="flex items-center gap-2"><Zap size={20} className="text-primary"/><span className="text-[10px] font-black uppercase tracking-widest">IA Triagem Ativa</span></div>
             </div>
             <div className="text-center">
                <p className="text-[9px] font-black text-black/40 uppercase tracking-[0.4em] mb-2">LexisPredict Elite Master System • 2026 W1 Capital</p>
                <div className="flex items-center justify-center gap-2 text-xs font-black uppercase">
                   <Copyright size={12} /> Davi Alves Figueredo • Todos os direitos reservados.
                </div>
             </div>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background-color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .max-w-6xl { max-width: 100% !important; margin: 0 !important; }
          .shadow-\[12px_12px_0px_#000\] { box-shadow: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: any) {
  return (
    <div className="flex items-center gap-4 border-b-4 border-black pb-4">
       <div className="w-10 h-10 bg-black flex items-center justify-center text-white"><Icon size={20} /></div>
       <h2 className="text-xl font-black uppercase tracking-tighter">{title}</h2>
    </div>
  );
}

function TelemetryCard({ label, value, sub, color }: any) {
  return (
    <div className="border-2 border-black p-6 space-y-2">
       <p className="text-[9px] font-black uppercase text-black/40 tracking-widest">{label}</p>
       <div className="flex items-baseline gap-3">
          <span className={cn("text-4xl font-black tabular-nums", color)}>{value}</span>
          <span className="text-[10px] font-bold text-black/60 uppercase">{sub}</span>
       </div>
    </div>
  );
}

function KpiReportCard({ label, value, icon, color = "text-black" }: any) {
  return (
    <div className="bg-[#f8f9fb] border-2 border-black p-6 flex flex-col justify-between h-32">
       <div className="flex justify-between items-start opacity-40">
          <p className="text-[9px] font-black uppercase tracking-widest">{label}</p>
          {icon}
       </div>
       <p className={cn("text-3xl font-black tabular-nums", color)}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color = "text-white/60" }: any) {
  return (
    <div className="flex flex-col items-center text-center">
       <span className="text-[7px] font-black uppercase opacity-40 mb-1">{label}</span>
       <span className={cn("text-lg font-black tabular-nums", color)}>{value}</span>
    </div>
  );
}
