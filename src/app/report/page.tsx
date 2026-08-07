"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * DOSSIÊ OPERACIONAL v25.0 — AUDITORIA ACIONÁVEL E MEMÓRIA ESTRATÉGICA
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
  Target,
  Layers,
  Loader2,
  Gavel,
  UserCheck,
  ChevronRight,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  FileText,
  AlertCircle,
  StickyNote,
  User,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { fetchRepoCases, fetchRepoNotes } from "@/app/actions/case-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils"
import { countAtendidosNestaSemana, buildAtendimentosPorDiaSemana, labelSemanaAtual } from "@/lib/atendimento-semana";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/use-app-store";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { getSinalCapa } from "@/lib/sinal-capa";
import { calcularProbabilidadeEncerramento } from "@/lib/probabilidade-encerramento";
import { calcularScoreAdvogado } from "@/lib/score-engine";
import { generateRelatorioClaudeAction } from "@/app/actions/report-claude-action";

export default function UnifiedReport() {
  const { setCases } = useAppStore();
  const [cases, setLocalCases] = useState<LegalCase[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [claudeText, setClaudeText] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState("");
  const [claudeReady, setClaudeReady] = useState(false);
  const [claudeEngine, setClaudeEngine] = useState("");
 
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
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
   
    const countVencido = ativos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => c.status === 'É Hoje').length;
    
    const countNovoAndamento = ativos.filter(c => !!c.tem_novo_andamento).length;
    const countEncerradoTribunal = ativos.filter(c => !!c.datajud_encerrado_tribunal).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;
    const countCumprimento = ativos.filter(c => !!c.em_cumprimento_sentenca).length;
    const countAtendidosSemana = countAtendidosNestaSemana(ativos as any);
    const serieAtendimentosSemana = buildAtendimentosPorDiaSemana(ativos as any);
    const semanaLabel = labelSemanaAtual();

    const topCriticos = ativos
      .map(c => ({ case: c, sinal: getSinalCapa(c) }))
      .filter(i => i.sinal.prioridade > 10 || i.case.status === 'Vencido')
      .sort((a, b) => {
        if (b.sinal.prioridade !== a.sinal.prioridade) return b.sinal.prioridade - a.sinal.prioridade;
        const dateA = a.sinal.data ? new Date(a.sinal.data).getTime() : 0;
        const dateB = b.sinal.data ? new Date(b.sinal.data).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);

    const topChance = ativos
      .map(c => {
        let prob = calcularProbabilidadeEncerramento({ 
          status: c.status, 
          situacao: c.situacao, 
          observacao: c.observacao, 
          diasVencidos: c.diasFaltando ? Math.abs(c.diasFaltando) : 0 
        });
        if (c.datajud_encerrado_tribunal) prob = 98;
        else if (c.em_cumprimento_sentenca) prob = Math.max(prob, 85);
        else if (c.evento_tipo?.startsWith('sentenca')) prob = Math.max(prob, 70);

        return { case: c, prob };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 10);

    const filterMerit = (type: string, keyword: string) => {
      return cases.filter(c => 
        c.evento_tipo === type || 
        (c.evento_resumo?.toUpperCase().includes(keyword) && !c.evento_resumo?.toUpperCase().includes('PARA'))
      ).slice(0, 10);
    };

    const listCumprimento = cases.filter(c => !!c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca').slice(0, 10);
    const listProcedente = filterMerit('sentenca_procedente', 'PROCEDENTE');
    const listImprocedente = filterMerit('sentenca_improcedente', 'IMPROCEDENTE');

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

    const isMaster = checkIfSuperAdmin(profile) || checkIfSupervisor(profile);

    const myAtivos = cases.filter(c => c.created_by === profile?.auth_user_id && !isCasoEncerrado(c));
    const myVencidos = myAtivos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').slice(0, 10);
    const myNovidades = myAtivos.filter(c => !!c.tem_novo_andamento).slice(0, 10);

    const riskScore = activeTotal > 0 ? Math.min(100, Math.round(((countVencido * 1 + countBA * 2 + countNovoAndamento * 0.5) / activeTotal) * 100)) : 0;

    return {
      activeTotal,
      countVencido,
      countHoje,
      countNovoAndamento,
      countEncerradoTribunal,
      countBA,
      countCumprimento,
      countAtendidosSemana,
      serieAtendimentosSemana,
      semanaLabel,
      riskScore,
      isMaster,
      myVencidos,
      myNovidades,
      topCriticos,
      topChance,
      listCumprimento,
      listProcedente,
      listImprocedente,
      top3Lawyers: lawyerRank.slice(0, 3),
      bottom3Lawyers: lawyerRank.length > 3 ? lawyerRank.slice(-3).reverse() : []
    };
  }, [cases, profile]);

  const buildResumoCarteira = () => {
    const topCrit = metrics.topCriticos.slice(0, 8).map((i) =>
      `${i.case.cliente} | ${i.case.protocolo} | ${i.sinal.titulo}`
    ).join("\n");
    const topCh = metrics.topChance.slice(0, 5).map((i) =>
      `${i.case.cliente} | ${i.case.protocolo} | ${i.prob}%`
    ).join("\n");
    return [
      `Auditor: ${profile?.nome || "—"} | Cargo: ${profile?.cargo || "—"}`,
      `Ativos: ${metrics.activeTotal}`,
      `Vencidos: ${metrics.countVencido} | É hoje: ${metrics.countHoje}`,
      `Novidades (andamento): ${metrics.countNovoAndamento}`,
      `Baixas tribunal: ${metrics.countEncerradoTribunal}`,
      `Busca e apreensão: ${metrics.countBA}`,
      `Cumprimento de sentença: ${metrics.countCumprimento}`,
      `Atendimentos nesta semana (${metrics.semanaLabel}): ${metrics.countAtendidosSemana}`,
      `Por dia: ${(metrics.serieAtendimentosSemana || []).map((d: any) => d.day + '=' + d.atendimentos).join(', ')}`,
      `Risco carteira: ${metrics.riskScore}%`,
      `Procedentes (lista): ${metrics.listProcedente.length}`,
      `Improcedentes (lista): ${metrics.listImprocedente.length}`,
      `Top críticos:\n${topCrit || "(nenhum)"}`,
      `Top chance encerramento:\n${topCh || "(nenhum)"}`,
      `Anotações no gabinete: ${notes.length}`,
    ].join("\n");
  };

  const handleGenerateClaude = async () => {
    setClaudeLoading(true);
    setClaudeError("");
    setClaudeReady(false);
    try {
      const res = await generateRelatorioClaudeAction({
        resumoCarteira: buildResumoCarteira(),
        useClaude: true,
      });
      if (!res.success) {
        setClaudeError(res.error || "Falha Claude");
        setClaudeText("");
        setClaudeEngine(res.engineLabel || "");
        return;
      }
      setClaudeText(res.texto);
      setClaudeEngine(res.engineLabel || "Claude AI");
      setClaudeReady(true);
    } catch (e: any) {
      setClaudeError(e?.message || "Falha ao chamar Claude");
      setClaudeReady(false);
    } finally {
      setClaudeLoading(false);
    }
  };

  const handlePrint = () => {
    if (!claudeReady) return;
    const d = new Date().toLocaleString("pt-BR");
    document.title = `Dossie_Operacional_Claude_${d}`;
    window.print();
  };

  if (!mounted || loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f2f2] space-y-6">
        <Loader2 className="w-12 h-12 text-foreground animate-spin" />
        <p className="font-black tracking-[0.4em] text-[10px] text-foreground uppercase">Consolidando Dossiê Authority...</p>
        <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-widest">Carregando carteira e atendimentos da semana…</p>
            </p>
          </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen lexis-report-root font-sans text-foreground">
      
      <div className="print:hidden sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b-2 border-black p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="h-10 px-4 font-black uppercase text-[10px] border-2 border-transparent hover:border-black rounded-none">
              <Link href="/"><ArrowLeft size={16} className="mr-2" /> Gabinete</Link>
            </Button>
            <Badge className="bg-black text-primary font-black uppercase text-[10px] px-4 rounded-none h-8">Sincronia Omni 100%</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerateClaude}
              disabled={claudeLoading}
              className="bg-primary hover:bg-primary/90 text-black font-black uppercase text-[10px] h-10 px-6 rounded-none border-2 border-black shadow-[4px_4px_0px_#000]"
            >
              {claudeLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
              Gerar parecer Claude AI
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!claudeReady}
              title={!claudeReady ? "Gere o parecer Claude antes de exportar o PDF oficial" : "Exportar PDF operacional"}
              className={cn(
                "font-black uppercase text-[10px] h-10 px-8 rounded-none shadow-[4px_4px_0px_#00D1FF] hover:shadow-none transition-all",
                claudeReady
                  ? "bg-black hover:bg-black/90 text-white"
                  : "bg-gray-300 text-black/40 cursor-not-allowed shadow-none"
              )}
            >
              <Printer size={16} className="mr-2" /> Imprimir / Exportar PDF operacional
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-10 print:py-0 space-y-12">
        
        <section className="bg-white border-8 border-black p-16 relative overflow-hidden break-inside-avoid">
           <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12 scale-150"><Layers size={300} /></div>
           <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-black flex items-center justify-center text-primary"><Layers size={28} /></div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-[0.4em]">LexisPredict Elite</h2>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-40">W1 Capital • Advanced Legal Operations</p>
                 </div>
              </div>
              <div className="pt-10">
                 <h1 className="text-6xl font-black uppercase tracking-tighter leading-[0.85] text-black">
                    Dossiê<br />Operacional<br /><span className="text-primary">Master</span>
                 </h1>
                 <p className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-60 mt-4">Relatório Consolidado de Mérito e Responsabilidade</p>
              </div>
           </div>
           <div className="flex justify-between items-end border-t-4 border-black mt-20 pt-8">
              <div className="space-y-1">
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Auditado por</p>
                 <p className="text-lg font-black uppercase tracking-tight">{profile?.nome}</p>
              </div>
              <div className="text-right">
                 <p className="text-2xl font-black tracking-tighter uppercase">{new Date().getFullYear()}</p>
                 <Badge variant="outline" className="border-black border-2 text-black font-black uppercase text-[8px] px-3">v.25.0 ELITE</Badge>
              </div>
           </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 break-inside-avoid">
           <KpiCard label="Ativos em Gestão" value={metrics.activeTotal} />
           <KpiCard label="Atendidos esta semana" value={metrics.countAtendidosSemana ?? 0} tone="info" />
           <KpiCard label="Vencidos / Hoje" value={`${metrics.countVencido} / ${metrics.countHoje}`} tone="danger" />
           <KpiCard label="Novidades Reais" value={metrics.countNovoAndamento} tone="info" />
           <KpiCard label="Risco da Carteira" value={`${metrics.riskScore}%`} tone={metrics.riskScore > 50 ? "danger" : "ok"} />
           <KpiCard label="Busca e Apreensão" value={metrics.countBA} />
           <KpiCard label="Baixas Tribunal" value={metrics.countEncerradoTribunal} />
           <KpiCard label="Fase Executiva" value={metrics.countCumprimento} />
        </section>

        <section className="rounded-2xl border-2 border-border bg-card p-6 space-y-3 break-inside-avoid">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Atendimentos nesta semana</p>
              <p className="text-3xl font-black tabular-nums text-foreground">{metrics.countAtendidosSemana ?? 0}
                <span className="text-sm font-bold text-muted-foreground ml-2">casos · {metrics.semanaLabel}</span>
              </p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Supervisor / Admin: carteira completa da empresa
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(metrics.serieAtendimentosSemana || []).map((d: any) => (
              <div key={d.day} className="min-w-[64px] rounded-xl border border-border bg-background/80 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase text-muted-foreground">{d.day}</p>
                <p className="text-lg font-black tabular-nums text-foreground">{d.atendimentos}</p>
              </div>
            ))}
          </div>
        </section>


        <section className="bg-white border-2 border-black break-inside-avoid">
           <div className="bg-black text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Sparkles className="text-primary" size={14}/> Análise Claude AI — Relatório
              </h3>
              <div className="flex items-center gap-2">
                {claudeReady ? (
                  <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase">Parecer pronto · PDF liberado</Badge>
                ) : (
                  <Badge className="bg-amber-500 text-black font-black text-[8px] uppercase">PDF oficial bloqueado até Claude</Badge>
                )}
                {claudeEngine ? (
                  <Badge variant="outline" className="border-white/30 text-white text-[8px] font-black">{claudeEngine}</Badge>
                ) : null}
              </div>
           </div>
           <div className="p-8 space-y-4">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-50">
                Dossiê Operacional · Claude AI · {new Date().toLocaleString("pt-BR")}
              </p>
              {claudeError ? (
                <div className="border-2 border-red-600 bg-red-50 p-4 text-[11px] font-bold text-red-800 whitespace-pre-wrap">
                  {claudeError}
                  <p className="mt-2 text-[10px] font-black uppercase">
                    Se HTTP 404/402: configure Anthropic em OmniRoute → Providers.
                  </p>
                </div>
              ) : null}
              {claudeLoading ? (
                <div className="flex items-center gap-3 text-[11px] font-black uppercase opacity-60">
                  <Loader2 className="animate-spin" size={18} /> Gerando parecer Claude…
                </div>
              ) : null}
              {claudeText ? (
                <div className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap border-2 border-black/10 p-6 bg-[#fafafa]">
                  {claudeText}
                </div>
              ) : (
                !claudeLoading && !claudeError ? (
                  <p className="text-[11px] font-bold uppercase opacity-40 italic">
                    Clique em &quot;Gerar parecer Claude AI&quot; para liberar o PDF operacional oficial.
                  </p>
                ) : null
              )}
           </div>
        </section>

        <section className="bg-white border-2 border-black break-inside-avoid">
           <div className="bg-black text-white p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Zap className="text-primary" size={14}/> Top 10: Criticidade por Movimentação</h3>
           </div>
           <div className="p-0 overflow-hidden">
              <table className="w-full text-left text-[9px] font-black uppercase">
                 <thead className="bg-[#f8f9fb] border-b-2 border-black">
                    <tr>
                       <th className="p-4">Cliente / Protocolo</th>
                       <th className="p-4">Natureza do Sinal</th>
                       <th className="p-4 text-center">Fonte</th>
                       <th className="p-4 text-right">Data</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-black/5">
                    {metrics.topCriticos.length > 0 ? metrics.topCriticos.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 group">
                         <td className="p-4">
                            <p className="text-[10px] font-black">{item.case.cliente}</p>
                            <p className="text-[8px] opacity-40 font-mono">{item.case.protocolo}</p>
                         </td>
                         <td className="p-4">
                            <p className={cn(item.sinal.prioridade >= 80 ? "text-red-600" : "text-black")}>{item.sinal.titulo}</p>
                            <p className="text-[8px] font-bold opacity-40 lowercase italic line-clamp-1">{item.sinal.detalhe}</p>
                         </td>
                         <td className="p-4 text-center">
                            <Badge variant="outline" className="text-[7px] font-black border-black/10 uppercase">{item.sinal.fonte}</Badge>
                         </td>
                         <td className="p-4 text-right opacity-60">
                           {item.sinal.data ? new Date(item.sinal.data).toLocaleDateString('pt-BR') : '---'}
                         </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-10 text-center opacity-40">Nenhum sinal crítico pós-auditoria</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </section>

        <section className="bg-white border-2 border-black break-inside-avoid">
           <div className="bg-emerald-600 text-white p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Target size={16}/> Top 10: Maior Chance de Encerramento</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x-2 divide-y-2 divide-black/10">
              {metrics.topChance.length > 0 ? metrics.topChance.map((item, i) => (
                 <div key={i} className="p-5 flex items-center justify-between hover:bg-emerald-50 transition-all group">
                    <div className="min-w-0">
                       <p className="text-[10px] font-black uppercase truncate">{item.case.cliente}</p>
                       <p className="text-[8px] font-mono opacity-40">{item.case.protocolo}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-emerald-600">{item.prob}%</p>
                       <p className="text-[7px] font-black uppercase opacity-40">Probabilidade</p>
                    </div>
                 </div>
              )) : (
                <div className="p-10 text-center col-span-2 opacity-40">Sem previsões de encerramento ativas</div>
              )}
           </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 break-inside-avoid">
           <MeritList title="Fase Executiva" data={metrics.listCumprimento} icon={<Activity size={14}/>} color="bg-blue-600" />
           <MeritList title="Vitórias (Procedente)" data={metrics.listProcedente} icon={<CheckCircle2 size={14}/>} color="bg-emerald-600" />
           <MeritList title="Revisões (Improcedente)" data={metrics.listImprocedente} icon={<AlertTriangle size={14}/>} color="bg-red-600" />
        </section>

        <section className="bg-white border-2 border-black break-inside-avoid">
           <div className="bg-black text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                 <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3"><UserCheck className="text-primary" size={18}/> Auditoria de Responsabilidade</h3>
                 <p className="text-[9px] font-bold uppercase opacity-60">Status da carteira atribuída ao perfil: {profile?.nome}</p>
              </div>
              <div className="flex gap-4">
                 <Badge className="bg-red-600 text-white font-black text-[9px] px-3 py-1 uppercase">{metrics.myVencidos.length} Vencidos</Badge>
                 <Badge className="bg-blue-600 text-white font-black text-[9px] px-3 py-1 uppercase">{metrics.myNovidades.length} Novidades</Badge>
              </div>
           </div>
           
           <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase border-b-2 border-black/5 pb-2 text-red-600 flex items-center gap-2"><Clock size={12}/> Meus Prazos Vencidos</h4>
                 <div className="space-y-3">
                    {metrics.myVencidos.map((c, i) => (
                      <Link key={i} href={`/cases?search=${c.protocolo}`} className="block p-3 bg-red-50 border-l-4 border-red-600 hover:translate-x-1 transition-transform">
                         <p className="text-[10px] font-black uppercase text-red-900">{c.cliente}</p>
                         <p className="text-[8px] font-bold text-red-600/60 uppercase">Vencido em: {c.proximoPrazo}</p>
                      </Link>
                    ))}
                    {metrics.myVencidos.length === 0 && <p className="text-[9px] font-black uppercase opacity-30 italic">Nenhum prazo vencido no escopo.</p>}
                 </div>
              </div>
              
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase border-b-2 border-black/5 pb-2 text-blue-600 flex items-center gap-2"><Zap size={12}/> Novidades Pendentes</h4>
                 <div className="space-y-3">
                    {metrics.myNovidades.map((c, i) => {
                      const sinal = getSinalCapa(c);
                      return (
                        <Link key={i} href={`/cases?search=${c.protocolo}`} className="block p-3 bg-blue-50 border-l-4 border-blue-600 hover:translate-x-1 transition-transform">
                           <p className="text-[10px] font-black uppercase text-blue-900">{c.cliente}</p>
                           <p className="text-[8px] font-bold text-blue-600/60 uppercase">{sinal.titulo}</p>
                        </Link>
                      );
                    })}
                    {metrics.myNovidades.length === 0 && <p className="text-[9px] font-black uppercase opacity-30 italic">Nenhuma novidade pendente.</p>}
                 </div>
              </div>
           </div>
        </section>

        <section className="bg-white border-2 border-black break-inside-avoid">
           <div className="bg-slate-50 border-b-2 border-black p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><StickyNote className="text-primary" size={14}/> Anotações e Evidências do Gabinete</h3>
              <Badge variant="outline" className="border-black/10 text-[8px] font-black">{notes.length} Registros</Badge>
           </div>
           <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {notes.length > 0 ? notes.slice(0, 20).map((note) => (
                   <div key={note.id} className="p-6 border-2 border-black bg-white space-y-4 flex flex-col h-full shadow-[4px_4px_0px_#000]">
                      {note.imageUrl && (
                        <div className="relative w-full h-40 border-2 border-black mb-2 overflow-hidden">
                           <img src={note.imageUrl} alt="Evidência" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black uppercase border-b border-black/5 pb-2 mb-2">{note.title}</p>
                        <p className="text-[11px] font-bold uppercase leading-relaxed text-black/70 italic line-clamp-4">"{note.content}"</p>
                      </div>
                      <div className="mt-auto pt-4 flex items-center justify-between opacity-30">
                         <span className="text-[8px] font-black uppercase tracking-widest">{note.updatedAt}</span>
                         <User size={10} />
                      </div>
                   </div>
                 )) : (
                   <div className="col-span-2 py-10 text-center opacity-30 font-black uppercase text-xs italic">Nenhuma anotação estratégica registrada.</div>
                 )}
              </div>
           </div>
        </section>

        {metrics.isMaster && (
           <section className="p-10 border-4 border-black break-inside-avoid bg-[#fafafa]">
              <div className="flex items-center gap-3 mb-10 border-b-2 border-black pb-4">
                 <Gavel size={20} className="text-primary" />
                 <h3 className="text-sm font-black uppercase tracking-widest">Governança de Banca: Performance de Advogados</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2"><TrendingUpIcon size={14}/> Top 3 Efficiency (Líderes)</p>
                    <div className="space-y-3">
                       {metrics.top3Lawyers.length > 0 ? metrics.top3Lawyers.map((l, i) => (
                         <div key={i} className="p-4 bg-white border-2 border-emerald-600 flex justify-between items-center shadow-[4px_4px_0px_#10b981]">
                            <span className="text-[10px] font-black uppercase">#{i+1} {l.name}</span>
                            <span className="text-lg font-black text-emerald-600">+{new Intl.NumberFormat('pt-BR').format(l.score)}</span>
                         </div>
                       )) : <p className="text-[9px] opacity-40 uppercase">Aguardando dados de score...</p>}
                    </div>
                 </div>

                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-red-600 tracking-[0.2em] flex items-center gap-2"><TrendingDownIcon size={14}/> Bottom 3 Performance (Revisão)</p>
                    <div className="space-y-3">
                       {metrics.bottom3Lawyers.length > 0 ? metrics.bottom3Lawyers.map((l, i) => (
                         <div key={i} className="p-4 bg-white border-2 border-red-600 flex justify-between items-center shadow-[4px_4px_0px_#ef4444]">
                            <span className="text-[10px] font-black uppercase">#{i+1} {l.name}</span>
                            <span className={cn("text-lg font-black", l.score < 0 ? "text-red-600" : "text-orange-600")}>
                              {new Intl.NumberFormat('pt-BR').format(l.score)}
                            </span>
                         </div>
                       )) : <p className="text-[9px] opacity-40 uppercase">Aguardando dados de score...</p>}
                    </div>
                 </div>
              </div>
           </section>
        )}

        <footer className="p-10 border-t-8 border-black flex justify-between items-center break-inside-avoid">
           <div className="flex items-center gap-6">
              <div className="w-10 h-10 border-4 border-black flex items-center justify-center bg-black"><Zap size={20} className="text-primary" /></div>
              <div>
                <p className="text-[10px] tracking-[0.4em] uppercase text-black font-black">2026 W1 CAPITAL • AUTHORITY SYSTEM</p>
                <p className="text-[7px] font-bold uppercase opacity-30 tracking-[0.2em]">
                  Dossiê Operacional · Claude AI · métricas locais + parecer
                </p>
              </div>
           </div>
           <p className="text-[9px] font-black uppercase text-black/60">Copyright © 2026 LexisPredict Elite</p>
        </footer>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: any; tone?: "default" | "danger" | "ok" | "info"; color?: string }) {
  const valueCls =
    tone === "danger" ? "lexis-kpi-value lexis-kpi-danger" :
    tone === "ok" ? "lexis-kpi-value lexis-kpi-ok" :
    tone === "info" ? "lexis-kpi-value lexis-kpi-info" :
    "lexis-kpi-value";
  return (
    <div className="lexis-kpi-card p-6 shadow-[6px_6px_0px_rgba(15,23,42,0.12)] transition-all">
      <p className="lexis-kpi-label text-[9px] font-black uppercase mb-2 tracking-widest">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums", valueCls)}>{value}</p>
    </div>
  );
}

function MeritList({ title, data, icon, color }: { title: string, data: LegalCase[], icon: any, color: string }) {
  return (
    <div className="lexis-kpi-card flex flex-col h-full overflow-hidden">
       <div className={cn("text-white p-3 flex items-center justify-between", color)} data-keep-white>
          <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" data-keep-white>{icon} {title}</span>
          <Badge variant="outline" className="text-white border-white/30 text-[7px]" data-keep-white>{data.length}</Badge>
       </div>
       <div className="p-4 space-y-3 flex-1">
          {data.map((c, i) => (
            <Link key={i} href={`/cases?search=${c.protocolo}`} className="block border-b border-border/40 pb-2 hover:opacity-70">
               <p className="text-[9px] font-black uppercase truncate text-foreground">{c.cliente}</p>
               <p className="text-[7px] font-mono text-muted-foreground">{c.protocolo}</p>
            </Link>
          ))}
          {data.length === 0 && <p className="text-[8px] font-black uppercase text-muted-foreground py-10 text-center">Nenhum caso nesta categoria</p>}
       </div>
    </div>
  );
}
