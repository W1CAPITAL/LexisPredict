import { EncerrarKpisStrip } from "@/components/dashboard/encerrar-kpis-strip";
"use client";

import { useAdmin } from "@/hooks/use-admin";


/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * Dossiê operacional v26.0 — AUDITORIA ACIONÁVEL E MEMÓRIA ESTRATÉGICA
 * Theme-aware: funciona em light, dark e todos os presets (sem contraste quebrado).
 */

import React, { useState, useEffect, useMemo } from "react";
import { LegalCase, CaseNote } from "@/lib/case-logic";
import { Button } from "@/components/ui/button";
import {
  Printer,
  ArrowLeft,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Zap,
  Target,
  Layers,
  Loader2,
  Gavel,
  UserCheck,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  StickyNote,
  User,
  Sparkles,
  Lightbulb,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { fetchRepoCases, fetchRepoNotes } from "@/app/actions/case-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils"
import {
  countAtendidosNestaSemana,
  buildAtendimentosPorDiaSemana,
  labelSemanaAtual,
  countAtendidosNoPeriodo,
  buildAtendimentosPorDiaPeriodo,
  labelPeriodo,
  PERIODO_OPCOES,
  type PeriodoRelatorio,
} from "@/lib/atendimento-semana";
import { countAuditadosNestaSemana, countAuditadosTribunalSemana, countEditadosAppSemana } from "@/lib/processos-auditados";
import { Badge } from "@/components/ui/badge";
import { BiCompliancePanel } from "@/components/dashboard/bi-compliance-panel";
import { useAppStore } from "@/store/use-app-store";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { computeCarteiraKpis } from "@/lib/carteira-kpis";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { getSinalCapa } from "@/lib/sinal-capa"
import { listProcessosParados } from "@/lib/processos-parados";
import { computeOpsKpis, computeOpsLinha } from "@/lib/ops-linha";
import { calcularProbabilidadeEncerramento } from "@/lib/probabilidade-encerramento";
import { calcularScoreAdvogado } from "@/lib/score-engine";
import { generateRelatorioClaudeAction } from "@/app/actions/report-claude-action";
import {
  resumoFinanceiroAction,
  listHonorariosAction,
  type HonorarioRow,
} from "@/app/actions/financas-actions";
import { FileDown } from "lucide-react";

export default function UnifiedReport() {
  const { canExport, isViewer } = useAdmin();
  const { setCases } = useAppStore();
  const [cases, setLocalCases] = useState<LegalCase[]>([]);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [iaInsights, setIaInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>("esta_semana");
  const [mounted, setMounted] = useState(false);
  const [claudeText, setClaudeText] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState("");
  const [claudeReady, setClaudeReady] = useState(false);
  const [claudeEngine, setClaudeEngine] = useState("");
  const [financeResumo, setFinanceResumo] = useState<any>(null);
  const [financeRows, setFinanceRows] = useState<HonorarioRow[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const [casesData, notesData, finSum, finRows] = await Promise.all([
          fetchRepoCases(),
          fetchRepoNotes(),
          resumoFinanceiroAction(),
          listHonorariosAction({ limit: 60 }),
        ]);
        setLocalCases(casesData || []);
        setCases(casesData || []);
        setNotes(notesData || []);
        if (finSum.success) setFinanceResumo(finSum.resumo);
        if (finRows.success) setFinanceRows(finRows.rows);

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
    const kpis = computeCarteiraKpis(cases as any);
    const ativos = cases.filter(c => !isCasoEncerrado(c));
    const activeTotal = ativos.length;
    const countEncerradoCarteira = kpis.encerradosCarteira;
    const countEncerradoTribunal = kpis.baixasTribunal;

    const countVencido = ativos.filter(c => c.status === 'Vencido' || c.status === 'Caso Crítico').length;
    const countHoje = ativos.filter(c => c.status === 'É Hoje').length;

    const countNovoAndamento = ativos.filter(c => !!c.tem_novo_andamento).length;
    const countBA = ativos.filter(c => !!c.indicio_busca_apreensao).length;
    const countCumprimento = ativos.filter(c => !!c.em_cumprimento_sentenca).length;
    const countAtendidosSemana = countAtendidosNoPeriodo(cases as any, periodo);
    const countAuditadosSemana = countAuditadosNestaSemana(cases as any);
    const countAuditadosTribunal = countAuditadosTribunalSemana(cases as any);
    const countEditadosApp = countEditadosAppSemana(cases as any);
    const serieAtendimentosSemana = buildAtendimentosPorDiaPeriodo(cases as any, periodo);
    const semanaLabel = labelPeriodo(periodo);

    const mediaDia =
      serieAtendimentosSemana && serieAtendimentosSemana.length
        ? Math.round((serieAtendimentosSemana.reduce((acc, d: any) => acc + d.atendimentos, 0) / serieAtendimentosSemana.length) * 10) / 10
        : 0;

    const ops = computeOpsKpis(ativos as any);
    const topCriticos = ops.top.slice(0, 10).map((c) => ({ case: c, sinal: getSinalCapa(c), ops: computeOpsLinha(c) }));

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

    
    const topParados = listProcessosParados(ativos as any, 60, { includeSemScan: false, onlyConfirmados: true }).slice(0, 10);
    const countParados60 = listProcessosParados(ativos as any, 60, { includeSemScan: false, onlyConfirmados: true }).length;
    const countParados90 = listProcessosParados(ativos as any, 90, { includeSemScan: false, onlyConfirmados: true }).length;

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
    const riskLevel =
      riskScore >= 60 ? "CRÍTICO" :
      riskScore >= 35 ? "ALTO" :
      riskScore >= 18 ? "MODERADO" : "SAUDÁVEL";

    const recomendacoes: string[] = [];
    if (countVencido > 0) recomendacoes.push(`Priorizar a revisão de ${countVencido} prazo(s) vencido(s) — iniciar pelos de maior criticidade.`);
    if (countHoje > 0) recomendacoes.push(`Acompanhar ${countHoje} caso(s) com prazo "hoje" antes do encerramento do expediente.`);
    if (countNovoAndamento > 0) recomendacoes.push(`Responder/validar ${countNovoAndamento} novidade(s) de andamento para alinhamento do cliente.`);
    if (countBA > 0) recomendacoes.push(`Validar ${countBA} caso(s) com indício de busca e apreensão — decisão urgente.`);
    if (countCumprimento > 0) recomendacoes.push(`Impulsionar a fase executiva em ${countCumprimento} caso(s) em cumprimento de sentença.`);
    if (ops.replicaPendente > 0) recomendacoes.push(`Tratar ${ops.replicaPendente} réplica(s) pendente(s) — prazo de defesa do cliente.`);
    if (ops.silencio45 > 0) recomendacoes.push(`Auditar ${ops.silencio45} caso(s) sem ato no tribunal há 45+ dias.`);
    if (ops.baReal > 0) recomendacoes.push(`Validar ${ops.baReal} busca e apreensão real (classe + mandado) — não jurisprudência.`);
    if (countEncerradoTribunal > 0) recomendacoes.push(`Confirmar e arquivar ${countEncerradoTribunal} baixa(s) detectadas pelo tribunal.`);
    if (countAtendidosSemana > 0) recomendacoes.push(`Manter o ritmo de atendimento: ${countAtendidosSemana} caso(s) nesta semana (média ${mediaDia}/dia).`);
    if (recomendacoes.length === 0) recomendacoes.push("Carteira estável: manter rotina de acompanhamento e atualização cadastral.");

    return {
      activeTotal,
      countVencido,
      countHoje,
      countNovoAndamento,
      countEncerradoTribunal,
      countEncerradoCarteira,
      countBA,
      countCumprimento,
      replicaPendente: ops.replicaPendente,
      silencio45: ops.silencio45,
      baReal: ops.baReal,
      countAtendidosSemana,
      countAuditadosSemana,
      countAuditadosTribunal,
      countEditadosApp,
      serieAtendimentosSemana,
      semanaLabel,
      mediaDia,
      riskScore,
      riskLevel,
      recomendacoes,
      isMaster,
      myVencidos,
      myNovidades,
      topCriticos,
      topParados,
      countParados60,
      countParados90,
      topChance,
      listCumprimento,
      listProcedente,
      listImprocedente,
      top3Lawyers: lawyerRank.slice(0, 3),
      bottom3Lawyers: lawyerRank.length > 3 ? lawyerRank.slice(-3).reverse() : []
    };
  }, [cases, profile, periodo]);

  const buildResumoCarteira = () => {
    const topCrit = metrics.topCriticos.slice(0, 10).map((i) =>
      `${i.case.cliente} | ${i.case.protocolo} | ${i.sinal.titulo}`
    ).join("\n");
    const topCh = metrics.topChance.slice(0, 5).map((i) =>
      `${i.case.cliente} | ${i.case.protocolo} | ${i.prob}%`
    ).join("\n");
    return [
      `Auditor: ${profile?.nome || "—"} | Cargo: ${profile?.cargo || "—"}`,
      `Ativos: ${metrics.activeTotal}`,
      `Vencidos: ${metrics.countVencido} | É hoje: ${metrics.countHoje}`,
      `Réplica pendente: ${metrics.replicaPendente ?? 0} | Silêncio 45d: ${metrics.silencio45 ?? 0} | BA real: ${metrics.baReal ?? 0}`,
      `Novidades (andamento): ${metrics.countNovoAndamento}`,
      `Baixas tribunal: ${metrics.countEncerradoTribunal}`,
      `Encerrados carteira: ${metrics.countEncerradoCarteira}`,
      `Busca e apreensão: ${metrics.countBA}`,
      `Cumprimento de sentença: ${metrics.countCumprimento}`,
      `Atendimentos nesta semana (${metrics.semanaLabel}): ${metrics.countAtendidosSemana}`,
      `Por dia: ${(metrics.serieAtendimentosSemana || []).map((d: any) => d.day + '=' + d.atendimentos).join(', ')}`,
      `Risco carteira: ${metrics.riskScore}% (${metrics.riskLevel})`,
      `Procedentes (lista): ${metrics.listProcedente.length}`,
      `Improcedentes (lista): ${metrics.listImprocedente.length}`,
      `Finanças — A receber: ${financeResumo?.a_receber ?? 0} | Recebido: ${financeResumo?.pago ?? 0} | Vencido: ${financeResumo?.vencido ?? 0} | Lançamentos: ${financeResumo?.total ?? 0}`,
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
    /* PDF pode exportar sem parecer IA */
    // if (!claudeReady) return;
    const d = new Date().toLocaleString("pt-BR");
    document.title = `Dossie_Operacional_Claude_${d}`;
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!canExport) { alert("Modo visualização: download bloqueado."); return; }
    setPdfLoading(true);
    try {
      const [{ downloadPdf }, { DossieOperacionalPDF }] = await Promise.all([
        import("@/lib/pdf-download"),
        import("@/components/pdf/dossie-operacional-pdf"),
      ]);
      const money = (n?: number) =>
        (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const stamp = new Date().toISOString().slice(0, 10);
      const ok = await downloadPdf(
        <DossieOperacionalPDF
          data={{
            geradoEm: new Date().toLocaleString("pt-BR"),
            auditor: profile?.nome || "—",
            cargo: profile?.cargo || "—",
            kpis: [
              { label: "Ativos", value: String(metrics.activeTotal) },
              { label: "Vencidos", value: `${metrics.countVencido} / ${metrics.countHoje}` },
              { label: "Risco", value: `${metrics.riskScore}%` },
              { label: "B.A.", value: String(metrics.countBA) },
              { label: periodo === "mes" ? "Atend. mês" : periodo === "semana_passada" ? "Atend. sem. ant." : "Atend. semana", value: String(metrics.countAtendidosSemana ?? 0) },
              { label: "Auditados semana", value: String(metrics.countAuditadosSemana ?? 0) },
              { label: "Tribunal (sem.)", value: String(metrics.countAuditadosTribunal ?? 0) },
              { label: "Editados app", value: String(metrics.countEditadosApp ?? 0) },
            ],
            resumoExecutivo: metrics.recomendacoes,
            semana: {
              label: metrics.semanaLabel,
              series: (metrics.serieAtendimentosSemana || []).map((d: any) => ({
                day: d.day,
                atendidos: d.atendimentos,
              })),
              media: metrics.mediaDia,
            },
            finance:
              financeResumo && financeRows.length > 0
                ? {
                    aReceber: money(financeResumo?.a_receber),
                    pago: money(financeResumo?.pago),
                    vencido: money(financeResumo?.vencido),
                    lancamentos: financeResumo?.total ?? 0,
                    destaques: financeRows.slice(0, 10).map((r) => ({
                      cliente: r.cliente || "—",
                      descricao: r.descricao || r.tipo || "sem descrição",
                      valor: money(Number(r.valor)),
                      status: r.status || "—",
                    })),
                  }
                : null,
            claude: claudeReady && claudeText
                ? { engine: claudeEngine || "Claude AI", texto: claudeText }
                : null,
            criticos: metrics.topCriticos.map((i: any) => ({
              cliente: i.case.cliente,
              protocolo: i.case.protocolo,
              sinal: i.sinal.titulo,
              data: i.sinal.data ? new Date(i.sinal.data).toLocaleDateString("pt-BR") : "",
            })),
            topChance: metrics.topChance.map((i: any) => ({
              cliente: i.case.cliente,
              protocolo: i.case.protocolo,
              prob: i.prob,
            })),
            notas: notes.length,
          }}
        />,
        `Dossie_Operacional_${stamp}`
      );
      if (ok) {
        setClaudeReady(true);
      }
    } catch (e) {
      console.error("PDF:", e);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!mounted || loading || authLoading) {
    return (
      <div className="min-h-screen lexis-report-root flex flex-col items-center justify-center space-y-6">
        <Loader2 className="w-12 h-12 text-foreground animate-spin" />
        <p className="font-black tracking-[0.4em] text-[10px] text-foreground uppercase">Consolidando Dossiê Authority...</p>
        <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-widest">Carregando carteira e atendimentos da semana…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen lexis-report-root font-sans text-foreground">

      <div className="print:hidden sticky top-0 z-[100] bg-background/90 backdrop-blur-xl border-b border-border p-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <Button variant="ghost" asChild className="h-10 px-4 font-black uppercase text-[10px] border-2 border-transparent hover:border-border rounded-lg">
              <Link href="/"><ArrowLeft size={16} className="mr-2" /> Gabinete</Link>
            </Button>
            <Badge className="bg-primary text-primary-foreground font-black uppercase text-[10px] px-4 rounded-lg h-8">Sincronia Omni 100%</Badge>

            <div className="flex items-center gap-1.5 flex-wrap ml-2">
              {PERIODO_OPCOES.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setPeriodo(op.id)}
                  title={op.hint}
                  className={cn(
                    "h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-colors",
                    periodo === op.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleGenerateClaude}
              disabled={claudeLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] h-10 px-6 rounded-lg shadow-md"
            >
              {claudeLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
              Gerar parecer Claude AI
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="bg-success hover:bg-success/90 text-success-foreground font-black uppercase text-[10px] h-10 px-6 rounded-lg shadow-md"
            >
              {pdfLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileDown size={16} className="mr-2" />}
              Baixar PDF (arquivo)
            </Button>
            <Button
              onClick={handlePrint}
              disabled={false}
              title={claudeReady ? "Exportar PDF com parecer IA" : "Exportar PDF (parecer IA opcional)"}
              className={cn(
                "font-black uppercase text-[10px] h-10 px-8 rounded-lg transition-all",
                claudeReady
                  ? "bg-foreground hover:bg-foreground/90 text-background"
                  : "bg-muted text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <Printer size={16} className="mr-2" /> Imprimir / Exportar PDF operacional
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto py-10 print:py-0 space-y-12">

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card p-10 sm:p-16 relative overflow-hidden break-inside-avoid shadow-[6px_6px_0px_rgba(0,0,0,0.08)]">
           <div className="absolute top-0 right-0 p-10 opacity-[0.04] rotate-12 scale-150 text-primary"><Layers size={300} /></div>
           <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 bg-primary flex items-center justify-center text-primary-foreground rounded-lg"><Layers size={28} /></div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-[0.4em] text-foreground">LexisPredict Elite</h2>
                    <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">W1 Capital • Advanced Legal Operations</p>
                 </div>
              </div>
              <div className="pt-10">
                 <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter leading-[0.85] text-foreground">
                    Dossiê<br />Operacional<br /><span className="text-primary">Master</span>
                 </h1>
                 <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground mt-4">Relatório Consolidado de Mérito e Responsabilidade</p>
              </div>
           </div>
           <div className="flex justify-between items-end border-t-2 border-border mt-16 pt-8">
              <div className="space-y-1">
                 <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auditado por</p>
                 <p className="text-lg font-black uppercase tracking-tight text-foreground">{profile?.nome}</p>
              </div>
              <div className="text-right">
                 <p className="text-2xl font-black tracking-tighter uppercase text-foreground">{new Date().getFullYear()}</p>
                 <Badge variant="outline" className="border-border text-foreground font-black uppercase text-[8px] px-3">v.26.0 ELITE</Badge>
              </div>
           </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 break-inside-avoid">
           <KpiCard label="Ativos em Gestão" value={metrics.activeTotal} />
           <KpiCard label="Atendidos esta semana" value={metrics.countAtendidosSemana ?? 0} tone="info" />
           <KpiCard label="Auditados esta semana" value={metrics.countAuditadosSemana ?? 0} tone="info" />
           <KpiCard label="Tribunal (DataJud/DJEN)" value={metrics.countAuditadosTribunal ?? 0} />
           <KpiCard label="Editados no app" value={metrics.countEditadosApp ?? 0} />
           <KpiCard label="Vencidos / Hoje" value={`${metrics.countVencido} / ${metrics.countHoje}`} tone="danger" />
           <KpiCard label="Novidades Reais" value={metrics.countNovoAndamento} tone="info" />
           <KpiCard label="Risco da Carteira" value={`${metrics.riskScore}%`} tone={metrics.riskScore > 50 ? "danger" : "ok"} />
           <KpiCard label="Busca e Apreensão" value={metrics.countBA} />
           <KpiCard label="Baixas Tribunal" value={metrics.countEncerradoTribunal} />
           <KpiCard label="Encerrados carteira" value={metrics.countEncerradoCarteira} />
           <KpiCard label="Fase Executiva" value={metrics.countCumprimento} />
           <KpiCard label="Réplica pendente" value={metrics.replicaPendente ?? 0} tone="danger" />
           <KpiCard label="Silêncio tribunal ≥45d" value={metrics.silencio45 ?? 0} tone="danger" />
           <KpiCard label="B.A. real" value={metrics.baReal ?? 0} />
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-emerald-600 text-white p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><TrendingUpIcon size={14}/> Demonstrativo Financeiro — Honorários</h3>
              <Badge className="bg-white/20 text-white font-black text-[8px] uppercase">{financeResumo?.total ?? "—"} lançamentos</Badge>
           </div>
           <div className="p-8 space-y-6">
              {financeResumo ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">A receber</p>
                    <p className="text-xl font-black text-amber-600 tabular-nums">{(financeResumo?.a_receber || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Recebido</p>
                    <p className="text-xl font-black text-emerald-600 tabular-nums">{(financeResumo?.pago || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vencido</p>
                    <p className="text-xl font-black text-red-600 tabular-nums">{(financeResumo?.vencido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fluxo líquido</p>
                    <p className={cn("text-xl font-black tabular-nums", (financeResumo?.pago || 0) - (financeResumo?.a_receber || 0) >= 0 ? "text-emerald-600" : "text-red-600")}>
                      {((financeResumo?.pago || 0) - (financeResumo?.a_receber || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] font-black uppercase text-muted-foreground/60 text-center py-6">
                  Sem dados financeiros disponíveis — cadastre lançamentos em Finanças / Honorários.
                </p>
              )}
              {financeRows.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-[9px] font-black uppercase">
                    <thead className="bg-muted/60 border-b border-border">
                      <tr>
                        <th className="p-3 text-muted-foreground">Cliente / Protocolo</th>
                        <th className="p-3 text-muted-foreground">Tipo</th>
                        <th className="p-3 text-right text-muted-foreground">Valor</th>
                        <th className="p-3 text-center text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {financeRows.slice(0, 10).map((r) => (
                        <tr key={r.id} className="hover:bg-muted/40">
                          <td className="p-3">
                            <p className="text-[9px] font-black text-foreground">{r.cliente || "—"}</p>
                            <p className="text-[7px] text-muted-foreground font-mono">{r.protocolo || ""}</p>
                          </td>
                          <td className="p-3 text-muted-foreground">{r.tipo}</td>
                          <td className="p-3 text-right text-foreground tabular-nums">{(Number(r.valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn("text-[7px] font-black border", r.status === "pago" ? "border-emerald-500/40 text-emerald-600" : r.status === "cancelado" ? "border-border text-muted-foreground" : "border-amber-500/40 text-amber-600")}>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
           </div>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card p-6 space-y-3 break-inside-avoid">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Atendimentos no período</p>
              <p className="text-3xl font-black tabular-nums text-foreground">{metrics.countAtendidosSemana ?? 0}
                <span className="text-sm font-bold text-muted-foreground ml-2">casos · {metrics.semanaLabel}</span>
              </p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Supervisor / Admin: carteira completa da empresa
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(metrics.serieAtendimentosSemana || []).map((d: any) => {
              const acima = metrics.mediaDia > 0 && d.atendimentos > metrics.mediaDia;
              return (
                <div key={d.day} className={cn(
                  "min-w-[64px] rounded-xl border px-3 py-2 text-center transition-colors",
                  acima
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-background/80"
                )}>
                  <p className="text-[9px] font-black uppercase text-muted-foreground">{d.day}</p>
                  <p className={cn("text-lg font-black tabular-nums", acima ? "text-primary" : "text-foreground")}>{d.atendimentos}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Média de atendimentos por dia útil: {metrics.mediaDia}</p>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-primary text-primary-foreground p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Sparkles size={14}/> Análise IA AI — Relatório
              </h3>
              <div className="flex items-center gap-2">
                {claudeReady ? (
                  <Badge className="bg-success text-success-foreground font-black text-[8px] uppercase">Parecer pronto · PDF liberado</Badge>
                ) : (
                  <Badge className="bg-warning text-warning-foreground font-black text-[8px] uppercase">PDF oficial bloqueado até Claude</Badge>
                )}
                {claudeEngine ? (
                  <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground text-[8px] font-black">{claudeEngine}</Badge>
                ) : null}
              </div>
           </div>
           <div className="p-8 space-y-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Dossiê Operacional · Claude AI · {new Date().toLocaleString("pt-BR")}
              </p>
              {claudeError ? (
                <div className="border-2 border-destructive bg-destructive/10 p-4 text-[11px] font-bold text-destructive whitespace-pre-wrap">
                  {claudeError}
                  <p className="mt-2 text-[10px] font-black uppercase">
                    Se HTTP 404/402: configure Anthropic em OmniRoute → Providers.
                  </p>
                </div>
              ) : null}
              {claudeLoading ? (
                <div className="flex items-center gap-3 text-[11px] font-black uppercase text-muted-foreground">
                  <Loader2 className="animate-spin" size={18} /> Gerando parecer Claude…
                </div>
              ) : null}
              {claudeText ? (
                <div className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap border border-border bg-muted/40 p-6 text-foreground">
                  {claudeText}
                </div>
              ) : (
                !claudeLoading && !claudeError ? (
                  <p className="text-[11px] font-bold uppercase text-muted-foreground italic">
                    Clique em &quot;Gerar parecer Claude AI&quot; para liberar o PDF operacional oficial.
                  </p>
                ) : null
              )}
           </div>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-primary text-primary-foreground p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Lightbulb size={14}/> Resumo Executivo</h3>
              <Badge
                className={cn(
                  "font-black text-[8px] uppercase",
                  metrics.riskLevel === "CRÍTICO" ? "bg-destructive text-white" :
                  metrics.riskLevel === "ALTO" ? "bg-warning text-black" :
                  metrics.riskLevel === "MODERADO" ? "bg-warning text-black" :
                  "bg-success text-white"
                )}
              >
                Risco {metrics.riskLevel} · {metrics.riskScore}%
              </Badge>
           </div>
           <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Leitura da carteira</p>
                 <div className="space-y-2.5">
                    <InsightRow icon={<ShieldAlert size={13} />} tone={metrics.countVencido > 0 ? "danger" : "ok"} text={`${metrics.countVencido} prazo(s) vencido(s) e ${metrics.countHoje} prazo(s) para hoje — atenção máxima.`} />
                    <InsightRow icon={<Activity size={13} />} tone="ok" text={`${metrics.countAtendidosSemana} atendimento(s) registrado(s) nesta semana (média ${metrics.mediaDia}/dia).`} />
                    <InsightRow icon={<Zap size={13} />} tone="info" text={`${metrics.countNovoAndamento} caso(s) com novidade real de andamento aguardando resposta.`} />
                    <InsightRow icon={<Target size={13} />} tone="info" text={`${metrics.topChance.length} caso(s) com alta probabilidade de encerramento — revisar para baixa.`} />
                    <InsightRow icon={<CheckCircle2 size={13} />} tone="ok" text={`${metrics.countEncerradoTribunal} baixa(s) detectada(s) pelo tribunal e ${metrics.listProcedente.length} vitória(s) listada(s).`} />
                 </div>
              </div>
              <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Plano de ação recomendado</p>
                 <ol className="space-y-2">
                    {metrics.recomendacoes.slice(0, 6).map((r, i) => (
                       <li key={i} className="flex items-start gap-2.5 text-[11px] font-bold text-foreground/90">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[8px] font-black">{i + 1}</span>
                          {r}
                       </li>
                    ))}
                 </ol>
              </div>
           </div>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-primary text-primary-foreground p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Zap size={14}/> Top 10: Criticidade por Movimentação</h3>
           </div>
           <div className="p-0 overflow-hidden">
              <table className="w-full text-left text-[9px] font-black uppercase">
                 <thead className="bg-muted/60 border-b border-border">
                    <tr>
                       <th className="p-4 text-muted-foreground">Cliente / Protocolo</th>
                       <th className="p-4 text-muted-foreground">Natureza do Sinal</th>
                       <th className="p-4 text-center text-muted-foreground">Fonte</th>
                       <th className="p-4 text-right text-muted-foreground">Data</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/60">
                    {metrics.topCriticos.length > 0 ? metrics.topCriticos.map((item, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                         <td className="p-4">
                            <p className="text-[10px] font-black text-foreground">{item.case.cliente}</p>
                            <p className="text-[8px] text-muted-foreground font-mono">{item.case.protocolo}</p>
                            {(item as any).ops ? (
                              <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">
                                {(item as any).ops.score} · {(item as any).ops.proximo}
                              </p>
                            ) : null}
                         </td>
                         <td className="p-4">
                            <p className={cn(item.sinal.prioridade >= 80 ? "text-destructive" : "text-foreground")}>{item.sinal.titulo}</p>
                            <p className="text-[8px] font-bold text-muted-foreground lowercase italic line-clamp-1">{item.sinal.detalhe}</p>
                         </td>
                         <td className="p-4 text-center">
                            <Badge variant="outline" className="text-[7px] font-black border-border text-muted-foreground uppercase">{item.sinal.fonte}</Badge>
                         </td>
                         <td className="p-4 text-right text-muted-foreground">
                           {item.sinal.data ? new Date(item.sinal.data).toLocaleDateString('pt-BR') : '---'}
                         </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">Nenhum sinal crítico pós-auditoria</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-success text-success-foreground p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><Target size={16}/> Top 10: Maior Chance de Encerramento</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x-2 divide-y-2 divide-border/50">
              {metrics.topChance.length > 0 ? metrics.topChance.map((item, i) => (
                 <div key={i} className="p-5 flex items-center justify-between hover:bg-success/5 transition-all group">
                    <div className="min-w-0">
                       <p className="text-[10px] font-black uppercase truncate text-foreground">{item.case.cliente}</p>
                       <p className="text-[8px] font-mono text-muted-foreground">{item.case.protocolo}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-black text-success">{item.prob}%</p>
                       <p className="text-[7px] font-black uppercase text-muted-foreground">Probabilidade</p>
                    </div>
                 </div>
              )) : (
                <div className="p-10 text-center col-span-2 text-muted-foreground">Sem previsões de encerramento ativas</div>
              )}
           </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 break-inside-avoid">
           
        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid mb-4">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest">Processos parados (tribunal ≥60d)</h3>
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
              {(metrics as any).countParados60 ?? 0} · ≥90d: {(metrics as any).countParados90 ?? 0}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {((metrics as any).topParados || []).length === 0 && (
              <p className="text-[10px] text-muted-foreground uppercase font-bold col-span-2 py-6 text-center">Nenhum parado confirmado nesta faixa</p>
            )}
            {((metrics as any).topParados || []).map((item: any, i: number) => (
              <Link key={i} href={`/cases?search=${encodeURIComponent(item.case?.protocolo || '')}`} className="border border-border/50 rounded-xl p-3 hover:bg-secondary/30">
                <p className="text-[10px] font-black uppercase truncate">{item.case?.cliente}</p>
                <p className="text-[9px] font-mono opacity-50">{item.case?.protocolo}</p>
                <p className="text-[9px] mt-1 text-amber-700 font-bold">{item.diasParadoTribunal}d · score {item.scoreAcao}</p>
              </Link>
            ))}
          </div>
        </section>

<MeritList title="Fase Executiva" data={metrics.listCumprimento} icon={<Activity size={14}/>} color="bg-blue-600" />
           <MeritList title="Vitórias (Procedente)" data={metrics.listProcedente} icon={<CheckCircle2 size={14}/>} color="bg-emerald-600" />
           <MeritList title="Revisões (Improcedente)" data={metrics.listImprocedente} icon={<AlertTriangle size={14}/>} color="bg-red-600" />
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-primary text-primary-foreground p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                 <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3"><UserCheck size={18}/> Auditoria de Responsabilidade</h3>
                 <p className="text-[9px] font-bold uppercase text-primary-foreground/80">Status da carteira atribuída ao perfil: {profile?.nome}</p>
              </div>
              <div className="flex gap-4">
                 <Badge className="bg-destructive text-white font-black text-[9px] px-3 py-1 uppercase">{metrics.myVencidos.length} Vencidos</Badge>
                 <Badge className="bg-blue-600 text-white font-black text-[9px] px-3 py-1 uppercase">{metrics.myNovidades.length} Novidades</Badge>
              </div>
           </div>

           <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase border-b-2 border-border/50 pb-2 text-destructive flex items-center gap-2"><Clock size={12}/> Meus Prazos Vencidos</h4>
                 <div className="space-y-3">
                    {metrics.myVencidos.map((c, i) => (
                      <Link key={i} href={`/cases?search=${c.protocolo}`} className="block p-3 bg-destructive/10 border-l-4 border-destructive hover:translate-x-1 transition-transform rounded-r-lg">
                         <p className="text-[10px] font-black uppercase text-foreground">{c.cliente}</p>
                         <p className="text-[8px] font-bold text-muted-foreground uppercase">Vencido em: {c.proximoPrazo}</p>
                      </Link>
                    ))}
                    {metrics.myVencidos.length === 0 && <p className="text-[9px] font-black uppercase text-muted-foreground italic">Nenhum prazo vencido no escopo.</p>}
                 </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase border-b-2 border-border/50 pb-2 text-blue-600 flex items-center gap-2"><Zap size={12}/> Novidades Pendentes</h4>
                 <div className="space-y-3">
                    {metrics.myNovidades.map((c, i) => {
                      const sinal = getSinalCapa(c);
                      return (
                        <Link key={i} href={`/cases?search=${c.protocolo}`} className="block p-3 bg-blue-600/10 border-l-4 border-blue-600 hover:translate-x-1 transition-transform rounded-r-lg">
                           <p className="text-[10px] font-black uppercase text-foreground">{c.cliente}</p>
                           <p className="text-[8px] font-bold text-muted-foreground uppercase">{sinal.titulo}</p>
                        </Link>
                      );
                    })}
                    {metrics.myNovidades.length === 0 && <p className="text-[9px] font-black uppercase text-muted-foreground italic">Nenhuma novidade pendente.</p>}
                 </div>
              </div>
           </div>
        </section>

        <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
           <div className="lexis-report-band bg-muted text-foreground border-b border-border p-5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3"><StickyNote className="text-primary" size={14}/> Anotações e Evidências do Gabinete</h3>
              <Badge variant="outline" className="border-border text-muted-foreground text-[8px] font-black">{notes.length} Registros</Badge>
           </div>
           <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {notes.length > 0 ? notes.slice(0, 20).map((note) => (
                   <div key={note.id} className="p-6 border border-border bg-card rounded-xl space-y-4 flex flex-col h-full shadow-md">
                      {note.imageUrl && (
                        <div className="relative w-full h-40 border border-border rounded-lg mb-2 overflow-hidden">
                           <img src={note.imageUrl} alt="Evidência" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black uppercase border-b border-border/50 pb-2 mb-2 text-foreground">{note.title}</p>
                        <p className="text-[11px] font-bold uppercase leading-relaxed text-muted-foreground italic line-clamp-4">"{note.content}"</p>
                      </div>
                      <div className="mt-auto pt-4 flex items-center justify-between text-muted-foreground">
                         <span className="text-[8px] font-black uppercase tracking-widest">{note.updatedAt}</span>
                         <User size={10} />
                      </div>
                   </div>
                 )) : (
                   <div className="col-span-2 py-10 text-center text-muted-foreground font-black uppercase text-xs italic">Nenhuma anotação estratégica registrada.</div>
                 )}
              </div>
           </div>
        </section>

        {metrics.isMaster && (
           <section className="lexis-report-sheet rounded-2xl border border-border bg-card overflow-hidden break-inside-avoid">
              <div className="lexis-report-band bg-primary text-primary-foreground p-5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Gavel size={20} />
                    <h3 className="text-sm font-black uppercase tracking-widest">Governança de Banca: Performance de Advogados</h3>
                 </div>
                 <ListChecks size={18} className="text-primary-foreground/70" />
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-success tracking-[0.2em] flex items-center gap-2"><TrendingUpIcon size={14}/> Top 3 Efficiency (Líderes)</p>
                    <div className="space-y-3">
                       {metrics.top3Lawyers.length > 0 ? metrics.top3Lawyers.map((l, i) => (
                         <div key={i} className="p-4 bg-success/10 border border-success rounded-lg flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-foreground">#{i+1} {l.name}</span>
                            <span className="text-lg font-black text-success">+{new Intl.NumberFormat('pt-BR').format(l.score)}</span>
                         </div>
                       )) : <p className="text-[9px] text-muted-foreground uppercase">Aguardando dados de score...</p>}
                    </div>
                 </div>

                 <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-destructive tracking-[0.2em] flex items-center gap-2"><TrendingDownIcon size={14}/> Bottom 3 Performance (Revisão)</p>
                    <div className="space-y-3">
                       {metrics.bottom3Lawyers.length > 0 ? metrics.bottom3Lawyers.map((l, i) => (
                         <div key={i} className="p-4 bg-destructive/10 border border-destructive/40 rounded-lg flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-foreground">#{i+1} {l.name}</span>
                            <span className={cn("text-lg font-black", l.score < 0 ? "text-destructive" : "text-warning")}>
                              {new Intl.NumberFormat('pt-BR').format(l.score)}
                            </span>
                         </div>
                       )) : <p className="text-[9px] text-muted-foreground uppercase">Aguardando dados de score...</p>}
                    </div>
                 </div>
              </div>
           </section>
        )}

          <div className="print:hidden px-4 sm:px-6 mb-6 max-w-[1600px] mx-auto w-full">
            <BiCompliancePanel cases={cases} defaultOpen={true} />
          </div>
<footer className="lexis-report-sheet rounded-2xl border border-border bg-card p-10 flex justify-between items-center break-inside-avoid">
           <div className="flex items-center gap-6">
              <div className="w-10 h-10 border-2 border-primary rounded-lg flex items-center justify-center bg-primary text-primary-foreground"><Zap size={20} /></div>
              <div>
                <p className="text-[10px] tracking-[0.4em] uppercase text-foreground font-black">2026 W1 CAPITAL • AUTHORITY SYSTEM</p>
                <p className="text-[7px] font-bold uppercase text-muted-foreground tracking-[0.2em]">
                  Dossiê Operacional · Claude AI · métricas locais + parecer
                </p>
              </div>
           </div>
           <p className="text-[9px] font-black uppercase text-muted-foreground">Copyright © 2026 LexisPredict Elite</p>
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
    <div className="lexis-kpi-card rounded-xl p-5 border border-border bg-card transition-all">
      <p className="lexis-kpi-label text-[9px] font-black uppercase mb-2 tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums", valueCls)}>{value}</p>
    </div>
  );
}

function InsightRow({ icon, text, tone }: { icon: any; text: string; tone: "danger" | "ok" | "info" }) {
  const toneCls =
    tone === "danger" ? "text-destructive" :
    tone === "ok" ? "text-success" :
    "text-primary";
  return (
    <div className="flex items-start gap-2.5 text-[11px] font-bold text-foreground/90">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted", toneCls)}>{icon}</span>
      {text}
    </div>
  );
}

function MeritList({ title, data, icon, color }: { title: string, data: LegalCase[], icon: any, color: string }) {
  return (
    <div className="lexis-report-sheet rounded-xl border border-border bg-card flex flex-col h-full overflow-hidden">
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
