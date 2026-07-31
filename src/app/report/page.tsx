
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
  Image as ImageIcon
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
    
    // REGRA DE VIGILÂNCIA: Se encerrado no tribunal, não conta como andamento pendente
    const countNovoAndamento = ativos.filter(c => !!c.tem_atualizacao_pos_retorno && !c.datajud_encerrado_tribunal).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;

    const rateAndamento = activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;
    const rateEncerrado = activeTotal > 0 ? Math.round((countEncerradoTribunal / activeTotal) * 100) : 0;
    const rateBA = activeTotal > 0 ? Math.round((countBA / activeTotal) * 100) : 0;

    const riskSum = (countVencido * 1.0) + (countHoje * 0.8) + (countAtencao * 0.5) + (countSaudavel * 0.1);
    const riskScore = activeTotal > 0 ? Math.min(100, Math.round((riskSum / activeTotal) * 100)) : 0;

    let riskLabel = "BAIXO";
    let riskColor = "text-emerald-600";
    if (riskScore > 80) { riskLabel = "CRÍTICO"; riskColor = "text-red-600"; }
    else if (riskScore > 60) { riskLabel = "ALTO"; riskColor = "text-orange-600"; }
    else if (riskScore > 40) { riskLabel = "ELEVADO"; riskColor = "text-yellow-600"; }
    else if (riskScore > 20) { riskLabel = "MODERADO"; riskColor = "text-amber-600"; }

    const tribCounts: Record<string, number> = {};
    cases.forEach(c => {
      const name = c.tribunal || 'Outros';
      tribCounts[name] = (tribCounts[name] || 0) + 1;
    });

    const chartData = Object.entries(tribCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.split(' - ')[0], count }));

    const offices: Record<string, any> = {};
    const lawyers: Record<string, any> = {};

    cases.forEach(c => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase();
      const lawyerName = (c.advogado || "NÃO ATRIBUÍDO").trim().toUpperCase();
      const isAtivo = !isCasoEncerrado(c);

      if (!offices[officeName]) offices[officeName] = { name: officeName, total: 0, ativos: 0, vencidos: 0, hoje: 0, atencao: 0 };
      if (!lawyers[lawyerName]) lawyers[lawyerName] = { name: lawyerName, total: 0, ativos: 0, vencidos: 0, hoje: 0, atencao: 0 };

      offices[officeName].total++;
      lawyers[lawyerName].total++;

      if (isAtivo) {
        offices[officeName].ativos++;
        lawyers[lawyerName].ativos++;
        if (c.status === 'Vencido' || c.status === 'Caso Crítico') { offices[officeName].vencidos++; lawyers[lawyerName].vencidos++; }
        if (c.status === 'É Hoje') { offices[officeName].hoje++; lawyers[lawyerName].hoje++; }
        if (c.status === 'Atenção') { offices[officeName].atencao++; lawyers[lawyerName].atencao++; }
      }
    });

    // Chance de Encerramento (Top 5 Ativos por Potencial)
    const topChance = ativos
      .map(c => ({
        cliente: c.cliente,
        protocolo: c.protocolo,
        analysis: analisarChanceEncerramento(c)
      }))
      .filter(a => ['Muito Alta', 'Alta'].includes(a.analysis.level))
      .slice(0, 5);

    // Notas Metrics
    const notesTotal = notes.length;
    const notesComEvidencia = notes.filter(n => !!n.imageUrl).length;

    return {
      totalRepo, 
      activeTotal, 
      countVencido, 
      countHoje, 
      countAtencao, 
      countSaudavel, 
      countSemPrazo, 
      riskScore, 
      riskLabel, 
      riskColor,
      chartData,
      sortedOffices: Object.values(offices).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total),
      sortedLawyers: Object.values(lawyers).sort((a: any, b: any) => b.vencidos - a.vencidos || b.total - a.total),
      countNovoAndamento, rateAndamento,
      countEncerradoTribunal, rateEncerrado,
      countBA, rateBA,
      topChance,
      notesTotal,
      notesComEvidencia
    };
  }, [cases, notes]);

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
      <div className="print:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="text-black/70 hover:text-black hover:bg-black/5 font-black tracking-widest text-[10px] uppercase rounded-none h-10 px-4">
              <Link href="/"><ArrowLeft size={14} className="mr-2" /> Voltar ao Gabinete</Link>
            </Button>
            <div className="h-6 w-px bg-black/10 hidden sm:block" />
            <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[9px] px-3 py-1">Unified Report v4.0</Badge>
          </div>
          <Button onClick={handleExportPDF} className="bg-black hover:bg-black/90 text-white font-black uppercase text-[10px] tracking-widest h-11 px-7 rounded-none transition-all shadow-[4px_4px_0px_#00D1FF] hover:shadow-none">
            <Printer size={14} className="mr-2" /> Imprimir Dossiê Completo
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 print:px-0 print:py-0 animate-in fade-in duration-700">
        <div className="bg-white border-2 border-black print:border-0 shadow-[12px_12px_0px_#000]">
          <header className="relative overflow-hidden border-b-2 border-black">
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-black" />
            <div className="px-10 pt-12 pb-10 flex flex-col lg:flex-row justify-between gap-8">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border-2 border-black bg-black flex items-center justify-center"><Layers size={16} className="text-white" /></div>
                  <span className="text-[10px] tracking-[0.35em] uppercase text-black font-black">W1 Capital • Advanced Ops</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.9] text-black">DOSSIÊ OPERACIONAL<br /><span className="text-black/40">DA CARTEIRA</span></h1>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="px-3 py-1.5 bg-black text-white text-[10px] font-black tracking-widest uppercase">RELATÓRIO CONSOLIDADO</div>
                  <div className="flex items-center gap-2 text-[11px] text-black/60 font-bold uppercase"><Calendar size={12} />{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
                </div>
              </div>
              <div className="text-right space-y-2 self-end">
                <p className="text-sm font-black tracking-wide text-black uppercase">{profile?.nome || "ADMINISTRADOR"}</p>
                <p className="text-[10px] tracking-[0.2em] uppercase text-black/40 font-bold">Gerado via Autoridade v250.0 Elite</p>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 border-2 border-green-600 text-green-600 text-[9px] font-black tracking-widest uppercase"><ShieldCheck size={11} /> Auditado</div>
              </div>
            </div>
          </header>

          <section className="px-10 py-10 bg-[#f8f9fb]">
             <div className="mb-10 p-8 border-4 border-black bg-black text-white shadow-[10px_10px_0px_#00D1FF]">
                <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Zap className="text-primary" size={14}/> Telemetria Forense (DataJud)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Andamentos Judiciais não atendidos</p>
                      <div className="flex items-baseline gap-4">
                         <span className="text-4xl font-black tabular-nums">{metrics.countNovoAndamento} <span className="text-lg opacity-40">de {metrics.activeTotal}</span></span>
                         <span className="text-xl font-black text-primary tabular-nums">({metrics.rateAndamento}%)</span>
                      </div>
                      <p className="text-[8px] font-bold uppercase italic opacity-40">Métrica de vigilância: processos com movimentos novos após o último retorno.</p>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Baixas identificadas no Tribunal</p>
                      <div className="flex items-baseline gap-4">
                         <span className="text-4xl font-black tabular-nums">{metrics.countEncerradoTribunal} <span className="text-lg opacity-40">de {metrics.activeTotal}</span></span>
                         <span className="text-xl font-black text-emerald-400 tabular-nums">({metrics.rateEncerrado}%)</span>
                      </div>
                      <p className="text-[8px] font-bold uppercase italic opacity-40">Métrica de resolutividade: ritos de encerramento detectados via auditoria unificada.</p>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase opacity-60">Indícios de Busca e Apreensão</p>
                      <div className="flex items-baseline gap-4">
                         <span className="text-4xl font-black tabular-nums">{metrics.countBA} <span className="text-lg opacity-40">de {metrics.activeTotal}</span></span>
                         <span className="text-xl font-black text-red-400 tabular-nums">({metrics.rateBA}%)</span>
                      </div>
                      <p className="text-[8px] font-bold uppercase italic opacity-40">Riscos detectados via análise neural de movimentos processuais.</p>
                   </div>
                </div>
             </div>

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-4 bg-white border-2 border-black p-7 flex flex-col justify-between min-h-[220px] shadow-[6px_6px_0px_#000]">
                <div>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-black/40 mb-4 font-black">Índice de Risco Calculado</p>
                  <div className="flex items-end gap-3">
                    <span className={cn("text-7xl font-black tracking-tighter leading-none", metrics.riskColor)}>{metrics.riskScore}</span>
                    <span className="text-black/20 text-lg font-black mb-2">/100</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-6">
                  <span className={cn("text-xs font-black tracking-[0.2em] uppercase", metrics.riskColor)}>{metrics.riskLabel}</span>
                  <div className="h-2 flex-1 mx-4 bg-gray-100 border border-black overflow-hidden">
                    <div className={cn("h-full transition-all", metrics.riskColor.replace('text', 'bg'))} style={{ width: `${metrics.riskScore}%` }} />
                  </div>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={<Activity size={16} />} label="Ativos em Gestão" value={metrics.activeTotal} accent="text-blue-600" />
                <KpiCard icon={<AlertTriangle size={16} />} label="Processos Vencidos" value={metrics.countVencido} accent="text-red-600" highlight={metrics.countVencido > 0} />
                <KpiCard icon={<CheckCircle2 size={16} />} label="Casos Saudáveis" value={metrics.countSaudavel} accent="text-green-600" />
                <KpiCard icon={<Clock size={16} />} label="Vencem Hoje" value={metrics.countHoje} accent="text-orange-600" highlight={metrics.countHoje > 0} />
              </div>
            </div>
          </section>

          {/* NOVO: VOLUMETRIA POR TRIBUNAL (GRÁFICO RESTAURADO) */}
          <section className="px-10 pb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-black" />
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Volumetria de Processos por Tribunal (Top 8)</h2>
            </div>
            <div className="bg-white border-2 border-black p-8 h-[350px]">
              {metrics.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.chartData}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#000', fontSize: 9, fontWeight: 900}} 
                    />
                    <YAxis hide />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                      {metrics.chartData.map((_, index) => (
                        <Cell key={index} fill={index === 0 ? '#000' : '#00D1FF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center opacity-20 uppercase font-black text-xs">Dados insuficientes para renderização gráfica</div>
              )}
            </div>
          </section>

          {/* NOVO: NOTAS E EVIDÊNCIAS (SEÇÃO ADICIONADA) */}
          <section className="px-10 pb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-black" />
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Notas, Anotações e Evidências</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
               <div className="bg-white border-2 border-black p-6 flex flex-col justify-center shadow-[4px_4px_0px_#000]">
                  <p className="text-[8px] font-black uppercase text-black/40 tracking-widest mb-1">Total de Anotações</p>
                  <div className="flex items-center gap-3">
                     <StickyNote size={20} className="text-black/20" />
                     <span className="text-4xl font-black">{metrics.notesTotal}</span>
                  </div>
               </div>
               <div className="bg-white border-2 border-black p-6 flex flex-col justify-center shadow-[4px_4px_0px_#00D1FF]">
                  <p className="text-[8px] font-black uppercase text-black/40 tracking-widest mb-1">Registros com Mídia/Anexo</p>
                  <div className="flex items-center gap-3">
                     <ImageIcon size={20} className="text-primary" />
                     <span className="text-4xl font-black">{metrics.notesComEvidencia}</span>
                  </div>
               </div>
            </div>

            <div className="border-2 border-black overflow-hidden bg-gray-50">
               <div className="bg-black text-white p-3 font-black text-[9px] uppercase tracking-widest flex items-center justify-between">
                  <span>Últimos Registros do Livro de Evidências</span>
                  <Badge className="bg-primary text-black rounded-none text-[8px]">Histórico v3.1</Badge>
               </div>
               <div className="divide-y-2 divide-black/5">
                  {notes.slice(0, 20).map((note, idx) => (
                    <div key={idx} className="p-5 bg-white space-y-1">
                       <div className="flex justify-between items-start">
                          <h4 className="text-[10px] font-black uppercase text-black">{note.title}</h4>
                          <span className="text-[8px] font-black text-black/30 uppercase tabular-nums">{note.updatedAt}</span>
                       </div>
                       <p className="text-[10px] font-bold text-black/60 uppercase leading-relaxed line-clamp-2 italic">
                         "{note.content}"
                       </p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="p-20 text-center space-y-4 opacity-20">
                       <StickyNote size={48} className="mx-auto" />
                       <p className="text-xs font-black uppercase">Nenhuma anotação registrada no período/carteira visível.</p>
                    </div>
                  )}
               </div>
            </div>
          </section>

          <section className="px-10 pb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-5 bg-black" />
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Distribuição Operacional dos Ativos</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatusPill label="Vencidos" count={metrics.countVencido} total={metrics.activeTotal} color="bg-red-600" />
              <StatusPill label="Hoje" count={metrics.countHoje} total={metrics.activeTotal} color="bg-orange-50" />
              <StatusPill label="Atenção" count={metrics.countAtencao} total={metrics.activeTotal} color="bg-amber-400" />
              <StatusPill label="Saudáveis" count={metrics.countSaudavel} total={metrics.activeTotal} color="bg-green-600" />
              <StatusPill label="Sem Prazo" count={metrics.countSemPrazo} total={metrics.activeTotal} color="bg-slate-400" />
              <StatusPill label="Ativos Totais" count={metrics.activeTotal} total={metrics.totalRepo} color="bg-black" />
            </div>
          </section>

          <section className="px-10 pb-12 space-y-12">
             {metrics.topChance.length > 0 && (
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={18} className="text-emerald-600" />
                    <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Prognóstico: Chance Alta de Encerramento</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {metrics.topChance.map((item, idx) => (
                       <ChanceEncerramentoCard key={idx} analysis={item.analysis} className="shadow-none border-2" />
                     ))}
                  </div>
               </div>
             )}

             <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <Building2 size={18} className="text-primary" />
                   <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Performance por Escritório / Unidade</h2>
                </div>
                <div className="border-2 border-black overflow-hidden">
                   <table className="w-full text-left text-[9px] font-black uppercase">
                      <thead className="bg-black text-white">
                         <tr>
                            <th className="p-3">Escritório</th>
                            <th className="p-3 text-center">Total</th>
                            <th className="p-3 text-center">Ativos</th>
                            <th className="p-3 text-center text-red-400">Vencidos</th>
                            <th className="p-3 text-center text-orange-400">Hoje</th>
                            <th className="p-3 text-center">Atenção</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-black/5">
                         {metrics.sortedOffices.map((off, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                               <td className="p-3">{off.name}</td>
                               <td className="p-3 text-center tabular-nums">{off.total}</td>
                               <td className="p-3 text-center tabular-nums">{off.ativos}</td>
                               <td className={cn("p-3 text-center tabular-nums", off.vencidos > 0 && "text-red-600 bg-red-50")}>{off.vencidos}</td>
                               <td className="p-3 text-center tabular-nums">{off.hoje}</td>
                               <td className="p-3 text-center tabular-nums">{off.atencao}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <Gavel size={18} className="text-primary" />
                   <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Performance por Advogado Responsável</h2>
                </div>
                <div className="border-2 border-black overflow-hidden">
                   <table className="w-full text-left text-[9px] font-black uppercase">
                      <thead className="bg-black text-white">
                         <tr>
                            <th className="p-3">Advogado</th>
                            <th className="p-3 text-center">Total</th>
                            <th className="p-3 text-center">Ativos</th>
                            <th className="p-3 text-center text-red-400">Vencidos</th>
                            <th className="p-3 text-center text-orange-400">Hoje</th>
                            <th className="p-3 text-center">Atenção</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-black/5">
                         {metrics.sortedLawyers.map((adv, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                               <td className="p-3">{adv.name}</td>
                               <td className="p-3 text-center tabular-nums">{adv.total}</td>
                               <td className="p-3 text-center tabular-nums">{adv.ativos}</td>
                               <td className={cn("p-3 text-center tabular-nums", adv.vencidos > 0 && "text-red-600 bg-red-50")}>{adv.vencidos}</td>
                               <td className="p-3 text-center tabular-nums">{adv.hoje}</td>
                               <td className="p-3 text-center tabular-nums">{adv.atencao}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </section>

          {iaInsights && (
            <section className="px-10 pb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-5 bg-black" />
                <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-black/60">Parecer Estratégico da Unidade Neural</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 border-2 border-black p-8">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={12}/> Pontos Fortes de Gabinete</p>
                    <ul className="space-y-2">
                      {iaInsights.pontosFortes?.map((item: string, idx: number) => (
                        <li key={idx} className="text-[11px] leading-relaxed text-black/80 uppercase font-black">• {item}</li>
                      ))}
                    </ul>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] flex items-center gap-2"><TrendingDown size={12}/> Riscos e Negativos Detectados</p>
                    <ul className="space-y-2">
                      {iaInsights.riscosDetectados?.map((item: string, idx: number) => (
                        <li key={idx} className="text-[11px] leading-relaxed text-black/80 uppercase font-black">• {item}</li>
                      ))}
                    </ul>
                 </div>
              </div>
            </section>
          )}

          <footer className="px-10 py-10 border-t-2 border-black">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 border-2 border-black flex items-center justify-center bg-black"><Zap size={16} className="text-white" /></div>
                <div>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-black/40 font-black">2026 W1 Capital</p>
                  <p className="text-xs text-black font-black uppercase">Relatório Executivo Operacional</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-black bg-white shadow-[4px_4px_0px_#00D1FF]">
                <ShieldCheck size={13} className="text-black" />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-black">Auditado por Davi Alves Figueredo</span>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { 
            background-color: white !important; 
            color: black !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .shadow-\[12px_12px_0px_#000\] { box-shadow: none !important; }
          .shadow-\[6px_6px_0px_#000\] { box-shadow: none !important; }
          .shadow-\[4px_4px_0px_#00D1FF\] { box-shadow: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ icon, label, value, accent, highlight = false }: { icon: React.ReactNode; label: string; value: number; accent: string; highlight?: boolean; }) {
  return (
    <div className={cn("bg-white border-2 p-5 flex flex-col justify-between min-h-[140px] shadow-[4px_4px_0px_#00D1FF]", highlight ? "border-red-600" : "border-black")}>
      <div className={cn("mb-4", accent)}>{icon}</div>
      <div>
        <p className="text-3xl font-black tracking-tighter text-black tabular-nums">{value}</p>
        <p className="text-[9px] font-black tracking-[0.15em] uppercase text-black/40 mt-1.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, count, total, color }: { label: string; count: number; total: number; color: string; }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const isTotalBase = label === "Ativos Totais";
  return (
    <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_#00D1FF]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black tracking-wide text-black/40 uppercase">{label}</span>
        <span className="text-xl font-black text-black tabular-nums">{count}</span>
      </div>
      <div className="h-2 w-full bg-gray-100 border border-black overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[8px] font-black text-black/30 mt-2 tabular-nums uppercase">
        {pct}% {isTotalBase ? "DA CARTEIRA TOTAL" : "DA CARTEIRA ATIVA"}
      </p>
    </div>
  );
}
