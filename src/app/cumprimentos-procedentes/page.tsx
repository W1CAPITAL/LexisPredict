"use client";

/**
 * Ações Procedentes e Cumprimentos de Sentença — aba exclusiva do módulo executivo.
 * Mapeia: procedências, cumprimentos ativos e cumprimentos pendentes omitidos.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Scale,
  Loader2,
  Search,
  RefreshCcw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  Gavel,
  ArrowUpDown,
  Download,
  Zap,
  Database,
} from "lucide-react";
import {
  getCumprimentosEProcedentesAction, enriquecerTeorFilaOportunidadeAction,
  enriquecerProcedenciaAction,
  reclassificarExecutivoCarteiraAction,
  batchScanExecutivoAction,
} from "@/app/actions/case-actions";
import { type LegalCase } from "@/lib/case-logic";
import { openWhatsAppClient } from "@/lib/whatsapp-links";
import { computeKpiExecutivo } from "@/lib/kpi-executivo";

type FiltroAtivo = "todos" | "pendente" | "ativo" | "encerrado" | "procedente" | "honorarios";

function casePhone(c?: LegalCase | null): string {
  if (!c) return "";
  return String(c.telefone || "").trim();
}

function diasDesdeTransito(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const hoje = new Date();
    return Math.floor((hoje.getTime() - d.getTime()) / (1000 * 3600 * 24));
  } catch {
    return null;
  }
}


function oportunidadeOf(c: LegalCase): {
  elegivel: boolean;
  score: number;
  tipo: string;
  riscos: string[];
  revisao: boolean;
  textoPobre: boolean;
  precisaEnriquecer: boolean;
} | null {
  const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
  const op =
    (c as any).oportunidade_instaurar ||
    dados.oportunidade_instaurar ||
    (c as any).detalhes_execucao?.oportunidade_instaurar ||
    dados.detalhes_execucao?.oportunidade_instaurar;
  if (!op && !(c as any).oportunidade_score && !dados.oportunidade_score) return null;
  return {
    elegivel: !!(c as any).oportunidade_elegivel || !!dados.oportunidade_elegivel || !!op?.elegivel,
    score: Number((c as any).oportunidade_score ?? op?.score ?? 0),
    tipo: String((c as any).oportunidade_tipo_credito || op?.tipo_credito || "incerto"),
    riscos: Array.isArray(op?.riscos) ? op.riscos : [],
    revisao: op?.requer_revisao_humana !== false,
    textoPobre: !!(c as any).texto_pobre || !!dados.texto_pobre || !!op?.texto_pobre,
    precisaEnriquecer:
      !!(c as any).precisa_enriquecer_teor ||
      !!dados.precisa_enriquecer_teor ||
      !!op?.precisa_enriquecer_teor,
  };
}

function statusExecutivo(c: LegalCase): string {
  const dados = ((c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {}) as any;
  const st =
    (c as any).status_executivo ||
    dados.status_executivo ||
    (c as any).detalhes_execucao?.status_executivo ||
    dados.detalhes_execucao?.status_executivo;
  if (st && st !== "nenhum") return String(st);
  if (c.cumprimento_pendente_necessario) return "pendente";
  if ((c as any).cumprimento_encerrado) return "encerrado";
  if ((c as any).cumprimento_ativo || c.em_cumprimento_sentenca) return "ativo";
  if (c.is_procedente) return "procedente";
  return "nenhum";
}

export default function CumprimentosProcedentesPage() {
  const { toast } = useToast();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroAtivo>("pendente");
  const [enriquecendo, setEnriquecendo] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scanCursor, setScanCursor] = useState(0);
  const [enrichBusy, setEnrichBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCumprimentosEProcedentesAction();
      if (res.success) {
        setCases(res.data);
      } else {
        setCases([]);
      }
    } catch {
      toast({ title: "Falha ao carregar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  const handleEnriquecerTeor = useCallback(async () => {
    setEnrichBusy(true);
    try {
      const r = await enriquecerTeorFilaOportunidadeAction({ limit: 15, onlyTextoPobre: true });
      if (r.success) {
        toast({
          title: "Enriquecimento seletivo",
          description: `${r.enriched}/${r.done} re-scan · restam ~${r.remaining} com texto pobre`,
        });
        await load();
      } else {
        toast({ title: "Falha", description: r.error || "erro", variant: "destructive" });
      }
    } catch {
      toast({ title: "Falha no enriquecimento", variant: "destructive" });
    } finally {
      setEnrichBusy(false);
    }
  }, [toast, load]);

  useEffect(() => {
    load();
  }, [load]);

  
  const kpiExecutivo = useMemo(() => computeKpiExecutivo((cases || []) as any), [cases]);

const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let base = [...cases];
    if (term) {
      base = base.filter((c) => {
        const nome = String(c.cliente || "").toLowerCase();
        const proto = String(c.protocolo || "").toLowerCase();
        const adv = String(c.advogado || (c as any).dados?.advogado || "").toLowerCase();
        const esc = String(c.escritorio || (c as any).dados?.escritorio || (c as any).dados?.ESCRITORIO || "").toLowerCase();
        return nome.includes(term) || proto.includes(term) || adv.includes(term) || esc.includes(term);
      });
    }
    // "Todos" = fila de AÇÃO (não lista quem já está em cumprimento ativo)
    if (filtro === "todos") {
      base = base.filter((c) => {
        const s = statusExecutivo(c);
        return s !== "ativo" && s !== "encerrado";
      });
    } else if (filtro === "honorarios") {
      base = base.filter((c) => {
        const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
        const op =
          (c as any).oportunidade_instaurar ||
          dados.oportunidade_instaurar ||
          (c as any).detalhes_execucao?.oportunidade_instaurar ||
          dados.detalhes_execucao?.oportunidade_instaurar;
        const elegivel =
          !!(c as any).oportunidade_elegivel ||
          !!dados.oportunidade_elegivel ||
          !!op?.elegivel;
        const score = Number((c as any).oportunidade_score ?? op?.score ?? 0);
        return elegivel && score >= 55;
      });
      // prioriza score alto
      base.sort((a, b) => {
        const sa = Number((a as any).oportunidade_score ?? (a as any).detalhes_execucao?.oportunidade_instaurar?.score ?? 0);
        const sb = Number((b as any).oportunidade_score ?? (b as any).detalhes_execucao?.oportunidade_instaurar?.score ?? 0);
        return sb - sa;
      });
    } else if (filtro === "pendente") {
      base = base.filter((c) => statusExecutivo(c) === "pendente" || c.cumprimento_pendente_necessario);
    } else if (filtro === "ativo") {
      base = base.filter((c) => statusExecutivo(c) === "ativo");
    } else if (filtro === "encerrado") {
      base = base.filter((c) => statusExecutivo(c) === "encerrado" || !!(c as any).cumprimento_encerrado);
    } else if (filtro === "procedente") {
      base = base.filter(
        (c) => statusExecutivo(c) === "procedente" || (c.is_procedente && !c.em_cumprimento_sentenca)
      );
    }
    const rank = (c: LegalCase) => {
      const s = statusExecutivo(c);
      if (s === "pendente") return 0;
      if (s === "ativo") return 1;
      if (s === "procedente") return 2;
      if (s === "encerrado") return 3;
      return 4;
    };
    base.sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      const da = a.data_transito_julgado || "";
      const db = b.data_transito_julgado || "";
      return da.localeCompare(db);
    });
    return base;
  }, [cases, q, filtro]);

  const stats = useMemo(() => {
    const pendentes = cases.filter((c) => statusExecutivo(c) === "pendente").length;
    const ativos = cases.filter((c) => statusExecutivo(c) === "ativo").length;
    const encerrados = cases.filter((c) => statusExecutivo(c) === "encerrado").length;
    const procedentes = cases.filter((c) => statusExecutivo(c) === "procedente" || (c.is_procedente && statusExecutivo(c) !== "ativo")).length;
    const honorarios = cases.filter((c) => {
      const dados = ((c as any).dados && typeof (c as any).dados === "object" ? (c as any).dados : {}) as any;
      const op =
        (c as any).oportunidade_instaurar ||
        dados.oportunidade_instaurar ||
        (c as any).detalhes_execucao?.oportunidade_instaurar ||
        dados.detalhes_execucao?.oportunidade_instaurar;
      const elegivel = !!(c as any).oportunidade_elegivel || !!dados.oportunidade_elegivel || !!op?.elegivel;
      const score = Number((c as any).oportunidade_score ?? op?.score ?? 0);
      return elegivel && score >= 55;
    }).length;
    return { total: cases.length, pendentes, ativos, encerrados, procedentes, honorarios };
  }, [cases]);

  const handleEnriquecer = async (protocolo: string) => {
    setEnriquecendo(protocolo);
    try {
      const res = await enriquecerProcedenciaAction(protocolo);
      if (res.success) {
        toast({ title: "Caso enriquecido", description: protocolo });
        await load();
      } else {
        toast({ title: "Falha", description: (res as any).error || "Erro", variant: "destructive" });
      }
    } finally {
      setEnriquecendo(null);
    }
  };

  const handleReclassLocal = async () => {
    setBulkBusy(true);
    try {
      const res = await reclassificarExecutivoCarteiraAction();
      if (!res.success) {
        toast({
          title: "Falha na reclassificação",
          description: res.error || "Erro",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reclassificação local concluída",
          description: `Varridos ${res.scanned} · atualizados ${res.updated} · hits executivos ${res.hits}`,
        });
        await load();
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBatchScan = async () => {
    setBulkBusy(true);
    try {
      const res = await batchScanExecutivoAction({
        limit: 25,
        onlyMissing: true,
        afterId: scanCursor || 0,
        priorizarEncerrados: true,
      });
      if ((res as any).lastId) setScanCursor(Number((res as any).lastId));
      if ((res as any).hasMore === false) setScanCursor(0);
      if (!res.success) {
        toast({
          title: "Falha no lote DataJud",
          description: res.error || "Erro",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Lote DataJud",
          description: `Processados ${res.done} · ok ${res.ok}. ${res.remaining_hint || ""} Clique de novo para o próximo lote.`,
        });
        await load();
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = filtered.length ? filtered : cases;
    if (!rows.length) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    const headers = [
      "cliente",
      "protocolo",
      "tribunal",
      "is_procedente",
      "em_cumprimento_sentenca",
      "cumprimento_pendente_necessario",
      "procedente_motivo",
      "cumprimento_sentenca_motivo",
      "data_transito_julgado",
      "advogado",
      "evento_resumo",
    ];
    const esc = (v: any) => {
      const s = String(v ?? "");
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(";")];
    for (const c of rows) {
      lines.push(
        [
          c.cliente,
          c.protocolo,
          c.tribunal,
          c.is_procedente ? "1" : "0",
          c.em_cumprimento_sentenca ? "1" : "0",
          c.cumprimento_pendente_necessario ? "1" : "0",
          (c as any).procedente_motivo,
          (c as any).cumprimento_sentenca_motivo,
          c.data_transito_julgado,
          c.advogado,
          c.evento_resumo,
        ]
          .map(esc)
          .join(";")
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumprimentos-procedentes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado", description: `${rows.length} linhas` });
  };

  const exportXls = () => {
    const rows = filtered.length ? filtered : cases;
    if (!rows.length) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    // Planilha XML simples (abre no Excel)
    const cell = (v: any) =>
      `<Cell><Data ss:Type="String">${String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</Data></Cell>`;
    const header = [
      "Cliente",
      "CNJ",
      "Tribunal",
      "Procedente",
      "Em cumprimento",
      "Pendente",
      "Motivo procedência",
      "Motivo cumprimento",
      "Trânsito",
      "Advogado",
      "Resumo",
    ];
    let table = `<Row>${header.map(cell).join("")}</Row>`;
    for (const c of rows) {
      table += `<Row>${[
        c.cliente,
        c.protocolo,
        c.tribunal,
        c.is_procedente ? "SIM" : "NÃO",
        c.em_cumprimento_sentenca ? "SIM" : "NÃO",
        c.cumprimento_pendente_necessario ? "SIM" : "NÃO",
        (c as any).procedente_motivo,
        (c as any).cumprimento_sentenca_motivo,
        c.data_transito_julgado
          ? String(c.data_transito_julgado).slice(0, 10)
          : "",
        c.advogado,
        c.evento_resumo,
      ]
        .map(cell)
        .join("")}</Row>`;
    }
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Executivo"><Table>${table}</Table></Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumprimentos-procedentes-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel exportado", description: `${rows.length} linhas` });
  };


  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Scale size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black uppercase text-sm sm:text-base tracking-tight truncate">
                Ações Procedentes e Cumprimentos
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium truncate">
                Principal extinto não esconde cumprimento · Pendente · Ativo · Encerrado · Procedente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
            <Badge variant="outline" className="text-[9px] font-bold">
              {stats.total} caso(s)
            </Badge>
            {stats.pendentes > 0 && (
              <Badge className="bg-red-600 text-[9px] font-bold">
                {stats.pendentes} pendente(s)
              </Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={bulkBusy}
              onClick={() => void handleReclassLocal()}
              title="Usa dados já salvos no banco — rápido, sem DataJud"
            >
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Reclassificar local
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={bulkBusy}
              onClick={() => void handleBatchScan()}
              title="DataJud+DJEN em lotes de 25 (só faltantes)"
            >
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
              Scan lote 25
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={!cases.length}
              onClick={exportCsv}
            >
              <Download size={12} /> CSV
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={!cases.length}
              onClick={exportXls}
            >
              <Download size={12} /> Excel
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={load}
              className="h-9 w-9 rounded-xl"
            >
              <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Filtros laterais */}
          <aside className="lg:col-span-3 border-r border-border/50 flex flex-col min-h-0 bg-card/40">
            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cliente, CNJ, advogado ou escritório"
                  className="pl-9 h-10 rounded-xl bg-background border-border/60"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {[
                  { key: "todos" as FiltroAtivo, label: "Ação (sem ativos)", icon: Scale, count: Math.max(0, stats.total - stats.ativos - stats.encerrados), color: "" },
                  { key: "honorarios" as FiltroAtivo, label: "Instaurar (honorários)", icon: AlertTriangle, count: stats.honorarios, color: "text-violet-600" },
                  { key: "pendente" as FiltroAtivo, label: "Falta instaurar", icon: AlertTriangle, count: stats.pendentes, color: "text-red-600" },
                  { key: "ativo" as FiltroAtivo, label: "Cumprimento ativo", icon: Clock, count: stats.ativos, color: "text-amber-600" },
                  { key: "encerrado" as FiltroAtivo, label: "Cumprimento encerrado", icon: Gavel, count: stats.encerrados, color: "text-slate-600" },
                  { key: "procedente" as FiltroAtivo, label: "Procedente", icon: CheckCircle2, count: stats.procedentes, color: "text-emerald-600" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFiltro(f.key)}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-2.5 border transition-colors flex items-center gap-2",
                      filtro === f.key
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <f.icon size={14} className={f.color} />
                    <span className="text-[12px] font-bold flex-1">{f.label}</span>
                    <Badge variant="outline" className="text-[9px] font-bold">
                      {f.count}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          {/* Lista principal */}
          <section className="lg:col-span-9 flex flex-col min-h-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                {cases.length === 0
                  ? "Nenhum caso com procedência ou cumprimento detectado. Execute um scan em Tarefas/Processos para enriquecer os dados."
                  : "Nenhum caso para este filtro."}
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {filtered.map((c) => {
                    const dias = diasDesdeTransito(c.data_transito_julgado);
                    const st = statusExecutivo(c);
                    const isPendente = st === "pendente";
                    const isAtivo = st === "ativo";
                    const isEncerrado = st === "encerrado";
                    const isProcedente = st === "procedente" || (!!c.is_procedente && st !== "ativo" && st !== "encerrado");
                    return (
                      <div
                        key={c.protocolo || c.id}
                        className={cn(
                          "rounded-xl border p-3 space-y-2 transition-colors hover:bg-muted/30",
                          isPendente
                            ? "border-red-500/40 bg-red-500/5"
                            : c.em_cumprimento_sentenca
                              ? "border-amber-500/30 bg-amber-500/5"
                              : "border-border/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-black uppercase text-sm truncate">
                              {c.cliente}
                            </p>
                            <p className="text-[10px] text-muted-foreground tabular-nums truncate">
                              {c.protocolo}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 shrink-0">
                            {isPendente && (
                              <Badge className="bg-red-600 text-[8px] font-black uppercase">
                                Pendente
                              </Badge>
                            )}
                            {c.em_cumprimento_sentenca && (
                              <Badge className="bg-amber-600 text-[8px] font-black uppercase">
                                Cumprimento
                              </Badge>
                            )}
                            {c.is_procedente && (
                              <Badge className="bg-emerald-600 text-[8px] font-black uppercase">
                                Procedente
                              </Badge>
                            )}
                            {(() => {
                              const op = oportunidadeOf(c);
                              if (!op || op.score <= 0) return null;
                              const hot = op.elegivel && op.score >= 55;
                              return (
                                <>
                                  <Badge
                                    className={
                                      hot
                                        ? "bg-violet-600 text-[8px] font-black uppercase"
                                        : "bg-slate-500 text-[8px] font-black uppercase"
                                    }
                                  >
                                    Score {op.score}
                                    {op.tipo !== "incerto" ? ` · ${op.tipo}` : ""}
                                  </Badge>
                                  {op.revisao && hot && (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-amber-500/50 text-amber-700">
                                      Revisar teor
                                    </Badge>
                                  )}
                                  {(op.textoPobre || op.precisaEnriquecer) && (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-500/50 text-orange-700">
                                      Texto pobre
                                    </Badge>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">
                            Adv: {String(c.advogado || (c as any).dados?.advogado || "—")}
                          </span>
                          <span>
                            Esc: {String(c.escritorio || (c as any).dados?.escritorio || (c as any).dados?.ESCRITORIO || "—")}
                          </span>
                          {(() => {
                            const s = statusExecutivo(c);
                            if (s === "pendente" || c.cumprimento_pendente_necessario) {
                              return (
                                <span className="text-red-700 dark:text-red-400 font-bold">
                                  Falta instaurar cumprimento?
                                </span>
                              );
                            }
                            if (s === "ativo") {
                              return <span className="text-amber-700">Cumprimento já ativo</span>;
                            }
                            if (c.is_procedente && s !== "ativo") {
                              return <span className="text-emerald-700">Procedente · avaliar execução</span>;
                            }
                            return null;
                          })()}
                          {(() => {
                            const op = oportunidadeOf(c);
                            if (!op?.riscos?.length) return null;
                            return <span className="text-amber-700 dark:text-amber-400">Risco: {op.riscos[0]}</span>;
                          })()}
                          {c.procedente_motivo && (
                            <span>Procedência: {c.procedente_motivo}</span>
                          )}
                          {c.cumprimento_sentenca_motivo && (
                            <span>Cumprimento: {c.cumprimento_sentenca_motivo}</span>
                          )}
                          {c.data_transito_julgado && (
                            <span>
                              Trânsito:{" "}
                              {new Date(c.data_transito_julgado).toLocaleDateString("pt-BR")}
                              {dias !== null ? ` (${dias}d)` : ""}
                            </span>
                          )}
                          {c.tribunal && <span>{c.tribunal}</span>}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-lg text-[10px] font-semibold gap-1"
                            onClick={() => handleEnriquecer(c.protocolo)}
                            disabled={enriquecendo === c.protocolo}
                          >
                            {enriquecendo === c.protocolo ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <FileSearch size={10} />
                            )}
                            Re-scannar
                          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 rounded-lg text-[10px] font-bold gap-1"
            disabled={enrichBusy || loading}
            onClick={handleEnriquecerTeor}
          >
            {enrichBusy ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
            Enriquecer teor (fila pobre)
          </Button>
                          {casePhone(c) && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 rounded-lg text-[10px] gap-1"
                              onClick={() =>
                                openWhatsAppClient({ phone: casePhone(c), text: "" })
                              }
                            >
                              <ExternalLink size={10} /> WhatsApp
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
