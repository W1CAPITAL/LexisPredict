"use client";

/**
 * Ações Procedentes · Especial e Cumprimentos de Sentença — aba exclusiva do módulo executivo.
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
import { Sparkles,
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
  Copy,
  Check,
  Paperclip,
  ListChecks,
  ShieldAlert,
} from "lucide-react";
import {
  getCumprimentosEProcedentesAction, enriquecerTeorFilaOportunidadeAction,
  enriquecerProcedenciaAction,
  reclassificarExecutivoCarteiraAction,
  batchScanExecutivoAction,
} from "@/app/actions/case-actions";
import { exportDemonstrativoCumprimentoAction } from "@/app/actions/export-cumprimento-demonstrativo";
import { extrairCreditoSentenca } from "@/lib/credito-sentenca-extract";
import { analisarHonorariosAReceber } from "@/lib/honorarios-receber";
import { simularLiquidacaoCumprimento, formatBRL } from "@/lib/liquidacao-cumprimento";
import {
  buildHandoffLegalcloud,
  handoffToClipboardText,
  urlCalculadoraLegalcloud,
} from "@/lib/legalcloud-bridge";
import {
  rankearCasoEspecial,
  ordenarFilaEspecial,
  kpiFilaEspecial,
} from "@/lib/pipeline-honorarios-especial";
import { scriptWhatsAppAposTeor } from "@/lib/script-cumprimento-whatsapp";
import { scanInstaurarComParadosBatchAction } from "@/app/actions/scan-instaurar-parados-action";
import { type LegalCase } from "@/lib/case-logic";
import { openWhatsAppClient } from "@/lib/whatsapp-links";
import { computeKpiExecutivo } from "@/lib/kpi-executivo";
import { getLimiarCobranca, LIMIAR_OPORTUNIDADE_COBRANCA } from "@/lib/oportunidade-cumprimento";
import { extrairDispositivoBullets, scriptWhatsAppCumprimentoSemValor, podeExibirValorMonetario } from "@/lib/dispositivo-sentenca";
import { CHECKLIST_LABELS, loadChecklist, saveChecklist, type ChecklistCumprimento, checklistAprovado } from "@/lib/checklist-cumprimento";
import { analisarContratoCumprimentoAction } from "@/app/actions/cumprimento-contrato-actions";
import type { CamposContratoFinanciamento } from "@/lib/contrato-financiamento-extract";
import { reconciliarFlagsCumprimento } from "@/lib/reconciliar-cumprimento-flags";
import { useDataJudScanStore } from "@/store/use-datajud-scan-store";
import {
  blobDoCaso,
  casePhone,
  diasDesdeTransito,
  oportunidadeOf,
  statusExecutivo,
  temConflitoFlags,
} from "@/lib/cumprimento-page-helpers";

type FiltroAtivo = "todos" | "pendente" | "ativo" | "encerrado" | "procedente" | "honorarios" | "hon_receber" | "parceiro" | "conflito" | "especial";

export default function CumprimentosProcedentesPage() {
  const { toast } = useToast();
  const {
    startManualScan,
    setScanScope,
    setScanMode,
    scanScope,
    manualStatus,
    manualDone,
    manualTotal,
    lastLogs,
    isMinimized,
    toggleMinimize,
  } = useDataJudScanStore();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroAtivo>("todos");
  const [vista, setVista] = useState<"lista" | "kanban">("lista");
  const [limiar, setLimiar] = useState(() => {
    try {
      const v = localStorage.getItem("lexis_limiar_cumprimento");
      return getLimiarCobranca(v ? Number(v) : null);
    } catch {
      return LIMIAR_OPORTUNIDADE_COBRANCA;
    }
  });
  const [copiedProto, setCopiedProto] = useState<string | null>(null);
  const [expandedProto, setExpandedProto] = useState<string | null>(null);
  const [contratoByProto, setContratoByProto] = useState<Record<string, {
    campos: CamposContratoFinanciamento;
    camposMinimos: boolean;
    provider?: string;
    textLen?: number;
  }>>({});
  const [contratoBusy, setContratoBusy] = useState<string | null>(null);
  const [checklistByProto, setChecklistByProto] = useState<Record<string, ChecklistCumprimento>>({});
  /** Lote 10 — inputs de liquidação (só UI interna; R$ não vai ao cliente) */
  const [liqByProto, setLiqByProto] = useState<Record<string, {
    principal: string;
    fator: string;
    jurosAa: string;
    abatimentos: string;
    custas: string;
    honPct: string;
    art523: boolean;
  }>>({});
  const [enriquecendo, setEnriquecendo] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scanCursor, setScanCursor] = useState(0);
  const [enrichBusy, setEnrichBusy] = useState(false);
  const [paradosScanBusy, setParadosScanBusy] = useState(false);

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


  
  const handleScanParadosInstaurar = useCallback(async () => {
    if (paradosScanBusy) return;
    setParadosScanBusy(true);
    try {
      let afterId: number | null = null;
      let scanned = 0;
      let refined = 0;
      let failed = 0;
      const samples: string[] = [];
      for (let i = 0; i < 15; i++) {
        const r = await scanInstaurarComParadosBatchAction({ limit: 5, afterId });
        if (!r.success) {
          toast({ title: "Erro no scan", description: r.error, variant: "destructive" });
          break;
        }
        scanned += r.scanned;
        refined += r.refined;
        failed += r.failed;
        samples.push(...(r.samples || []).slice(0, 3));
        if (r.afterId != null) afterId = r.afterId;
        if (!r.hasMore || r.scanned === 0) break;
        await new Promise((x) => setTimeout(x, 500));
      }
      toast({
        title: "Tribunal + parados",
        description: `Escaneados ${scanned} · refinados ${refined} · falhas ${failed}` +
          (samples.length ? ` · ${samples.slice(0, 2).join(" | ")}` : ""),
      });
      await load();
    } catch {
      toast({ title: "Falha no scan parados", variant: "destructive" });
    } finally {
      setParadosScanBusy(false);
    }
  }, [paradosScanBusy, toast, load]);

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

  // Lote1: escopo padrão = cumprimento + híbrido
  useEffect(() => {
    try {
      setScanScope("cumprimento");
      setScanMode("both");
    } catch {
      /* ignore */
    }
  }, [setScanScope, setScanMode]);

  // Lote1: atualiza lista a cada 3 CNJs durante a varredura
  useEffect(() => {
    if (manualStatus === "running" && manualDone > 0 && manualDone % 3 === 0) {
      void load();
    }
  }, [manualDone, manualStatus, load]);

  // Lote1: ao terminar, recarrega
  useEffect(() => {
    if (manualStatus === "done") {
      void load();
      toast({
        title: "Scanner cumprimento finalizado",
        description: "Ações Procedentes atualizadas (DataJud + DJEN).",
      });
    }
  }, [manualStatus, load, toast]);

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
        return elegivel && score >= limiar;
      });
      // prioriza score alto
      base.sort((a, b) => {
        const sa = Number((a as any).oportunidade_score ?? (a as any).detalhes_execucao?.oportunidade_instaurar?.score ?? 0);
        const sb = Number((b as any).oportunidade_score ?? (b as any).detalhes_execucao?.oportunidade_instaurar?.score ?? 0);
        return sb - sa;
      });
    } else if (filtro === "hon_receber") {
      base = base.filter((c) => {
        const blob = blobDoCaso(c);
        const h = analisarHonorariosAReceber(blob, {
          isProcedente: !!c.is_procedente,
          meritoTipo: (c as any).merito_tipo || (c as any).dados?.merito_tipo,
        });
        return h.temHonorariosAReceber && h.nivel !== "bloqueado";
      });
      base.sort((a, b) => {
        const ha = analisarHonorariosAReceber(blobDoCaso(a), { isProcedente: !!a.is_procedente });
        const hb = analisarHonorariosAReceber(blobDoCaso(b), { isProcedente: !!b.is_procedente });
        const rank = (n: string) => (n === "forte" ? 0 : n === "medio" ? 1 : 2);
        return rank(ha.nivel) - rank(hb.nivel) || hb.confianca - ha.confianca;
      });
    } else if (filtro === "especial") {
      // Versão Especial: pronto parceiro + honorários forte/médio, ordenados por prioridade
      base = ordenarFilaEspecial(
        base.filter((c) => {
          const r = rankearCasoEspecial(c, limiar);
          return (
            r.estagio === "pronto_parceiro" ||
            r.estagio === "hon_receber" ||
            (r.estagio === "teor_ok" && r.scoreOportunidade >= limiar * 0.7)
          );
        }),
        limiar
      );
    } else if (filtro === "parceiro") {
      // Empresa por fora: elegível + score ≥ limiar + sucumbência ou ambos (não cliente puro)
      base = base.filter((c) => {
        const op = oportunidadeOf(c);
        if (!op?.elegivel || op.score < limiar) return false;
        if (statusExecutivo(c) === "ativo" || statusExecutivo(c) === "encerrado") return false;
        const tipo = String(op.tipo || "").toLowerCase();
        return tipo === "sucumbencia" || tipo === "ambos";
      });
      base.sort((a, b) => {
        const sa = oportunidadeOf(a)?.score || 0;
        const sb = oportunidadeOf(b)?.score || 0;
        return sb - sa;
      });
    } else if (filtro === "conflito") {
      base = base.filter((c) => temConflitoFlags(c));
    } else if (filtro === "pendente") {
      // Só falta instaurar de verdade (sem fase ativa)
      base = base.filter((c) => statusExecutivo(c) === "pendente");
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
  }, [cases, q, filtro, limiar]);

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
      return elegivel && score >= limiar;
    }).length;
    const conflitos = cases.filter((c) => temConflitoFlags(c)).length;
    const honReceber = cases.filter((c) => {
      const h = analisarHonorariosAReceber(blobDoCaso(c), { isProcedente: !!c.is_procedente });
      return h.temHonorariosAReceber && h.nivel !== "bloqueado";
    }).length;
    const parceiro = cases.filter((c) => {
      const op = oportunidadeOf(c);
      if (!op?.elegivel || op.score < limiar) return false;
      if (statusExecutivo(c) === "ativo" || statusExecutivo(c) === "encerrado") return false;
      const tipo = String(op.tipo || "").toLowerCase();
      return tipo === "sucumbencia" || tipo === "ambos";
    }).length;
    const kpiEspecial = kpiFilaEspecial(cases, limiar);
    return { total: cases.length, pendentes, ativos, encerrados, procedentes, honorarios, conflitos, parceiro, honReceber, kpiEspecial };
  }, [cases, limiar]);

  /** Lote 9 — colunas Kanban por estágio comercial (rankearCasoEspecial) */
  const kanbanCols = useMemo(() => {
    const cols: Record<string, { title: string; color: string; items: typeof cases }> = {
      pronto_parceiro: { title: "★ Pronto parceiro", color: "border-violet-500/50 bg-violet-500/5", items: [] },
      hon_receber: { title: "Honorários a receber", color: "border-emerald-500/50 bg-emerald-500/5", items: [] },
      teor_ok: { title: "Teor OK", color: "border-blue-500/40 bg-blue-500/5", items: [] },
      triagem: { title: "Triagem", color: "border-orange-500/40 bg-orange-500/5", items: [] },
      em_cumprimento: { title: "Em cumprimento", color: "border-amber-500/40 bg-amber-500/5", items: [] },
      bloqueado: { title: "Bloqueados", color: "border-slate-400/40 bg-slate-500/5", items: [] },
    };
    for (const c of filtered) {
      try {
        const r = rankearCasoEspecial(c, limiar);
        const key =
          r.estagio === "pronto_parceiro"
            ? "pronto_parceiro"
            : r.estagio === "hon_receber"
              ? "hon_receber"
              : r.estagio === "teor_ok"
                ? "teor_ok"
                : r.estagio === "em_cumprimento"
                  ? "em_cumprimento"
                  : r.estagio === "bloqueado"
                    ? "bloqueado"
                    : "triagem";
        cols[key].items.push(c);
      } catch {
        cols.triagem.items.push(c);
      }
    }
    return cols;
  }, [filtered, limiar]);


  const copyProtocolo = async (proto: string) => {
    try {
      await navigator.clipboard.writeText(proto);
      setCopiedProto(proto);
      setTimeout(() => setCopiedProto(null), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };



  const handleAnexoContrato = async (protocolo: string, file: File | null) => {
    if (!file) return;
    setContratoBusy(protocolo);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("protocolo", protocolo);
      const res = await analisarContratoCumprimentoAction(fd);
      if (!res.success || !res.campos) {
        toast({ title: "Falha no contrato", description: res.error || "erro", variant: "destructive" });
        return;
      }
      setContratoByProto((prev) => ({
        ...prev,
        [protocolo]: {
          campos: res.campos!,
          camposMinimos: !!res.camposMinimos,
          provider: res.provider,
          textLen: res.textLen,
        },
      }));
      toast({
        title: res.camposMinimos ? "Contrato lido" : "Contrato parcial",
        description: res.camposMinimos
          ? `Campos extraídos (${res.provider}). Revise antes de qualquer R$.`
          : "Poucos campos — revise manualmente. Valores ao cliente continuam bloqueados.",
      });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e?.message || "falha", variant: "destructive" });
    } finally {
      setContratoBusy(null);
    }
  };

  const toggleChecklist = (protocolo: string, key: keyof ChecklistCumprimento) => {
    if (key === "updatedAt") return;
    setChecklistByProto((prev) => {
      const cur = prev[protocolo] || loadChecklist(protocolo);
      const next = { ...cur, [key]: cur[key] === true ? false : true } as ChecklistCumprimento;
      saveChecklist(protocolo, next);
      return { ...prev, [protocolo]: next };
    });
  };

  const handleScanCumprimento = async () => {
    setScanMode("both");
    setScanScope("cumprimento");
    if (isMinimized) toggleMinimize();
    toast({
      title: "Scanner · só cumprimento",
      description:
        "DataJud + DJEN (BOTH). Se o teor vier fraco, amplia automaticamente DJEN 2 anos e reanalisa — some o alerta de teor fraco quando o índice estiver ok.",
    });
    await startManualScan({ scope: "cumprimento" });
  };

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

  const downloadDemonstrativo = async (onlyParceiro: boolean) => {
    try {
      const res = await exportDemonstrativoCumprimentoAction({
        limiar,
        onlyParceiro,
      });
      if (!res.success || !res.csv) {
        toast({ title: "Falha no demonstrativo", description: res.error, variant: "destructive" });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.filename || "demonstrativo-cumprimento.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({
        title: onlyParceiro ? "Demonstrativo empresa por fora" : "Demonstrativo operacional",
        description: `${res.count || 0} linhas · score e flags (sem inventar R$)`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "export", variant: "destructive" });
    }
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
            
            <div className="flex flex-col gap-0.5 min-w-[140px]">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 h-8">
                <span className="text-[9px] font-black uppercase text-muted-foreground shrink-0">Limiar score</span>
                <input
                  type="number"
                  min={30}
                  max={95}
                  value={limiar}
                  onChange={(e) => {
                    const v = getLimiarCobranca(Number(e.target.value));
                    setLimiar(v);
                    try { localStorage.setItem("lexis_limiar_cumprimento", String(v)); } catch { /* */ }
                  }}
                  className="w-12 h-7 text-[11px] font-bold bg-transparent border-0 focus:outline-none tabular-nums"
                  aria-label="Limiar de score para honorários"
                />
              </div>
              <p className="text-[8px] text-muted-foreground leading-tight max-w-[200px]">
                Nota 0–100 da oportunidade. Só lista em &quot;Honorários ≥{limiar}&quot; / Empresa por fora quem tem score ≥ este valor (padrão {LIMIAR_OPORTUNIDADE_COBRANCA}). Não altera o scanner.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={manualStatus === "running" || bulkBusy}
              onClick={() => void handleScanCumprimento()}
              title="DataJud + DJEN só em candidatos a cumprimento/procedência"
            >
              {manualStatus === "running" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Gavel size={12} />
              )}
              {manualStatus === "running"
                ? `Varrendo ${manualDone}/${manualTotal || "…"}`
                : "Varrer só cumprimento"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={enrichBusy || loading}
              onClick={() => void handleEnriquecerTeor()}
            >
              {enrichBusy ? <Loader2 size={12} className="animate-spin" /> : <FileSearch size={12} />}
              Enriquecer teor
            </Button>
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
              variant="default"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1"
              disabled={paradosScanBusy || bulkBusy}
              onClick={() => void handleScanParadosInstaurar()}
              title="DataJud+DJEN + motor Processos Parados · só pendentes de instaurar (não ativos)"
            >
              {paradosScanBusy ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
              Scan + parados
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
              onClick={() => void downloadDemonstrativo(false)}
              title="Status, score, art.523, sucumbência — sem inventar R$"
            >
              <Download size={12} /> Demonstrativo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-[10px] font-black uppercase gap-1 border-violet-500/40 text-violet-800"
              disabled={!cases.length}
              onClick={() => void downloadDemonstrativo(true)}
              title="Só elegíveis ≥ limiar · sucumbência/ambos (empresa por fora)"
            >
              <Download size={12} /> Fila parceiro
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

        
        
        {/* VERSÃO ESPECIAL — Radar Honorários */}
        <div className="mx-4 sm:mx-6 mt-3 rounded-2xl border-2 border-violet-700/40 bg-gradient-to-br from-violet-50 via-white to-emerald-50 dark:from-violet-950/40 dark:via-background dark:to-emerald-950/20 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                <Sparkles size={14} /> Radar Honorários · Versão Especial
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xl">
                Prioriza casos com honorários a receber (forte/médio) e score ≥ limiar para a esteira comercial.
                Não inventa R$ — só sinal de teor + score.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-xl text-[10px] font-black uppercase bg-violet-700 hover:bg-violet-800 text-white gap-1"
              onClick={() => setFiltro("especial")}
            >
              <Sparkles size={12} /> Abrir fila especial
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { k: "Pronto parceiro", v: stats.kpiEspecial?.prontoParceiro ?? 0, c: "border-violet-600/50 text-violet-900" },
              { k: "Hon. forte", v: stats.kpiEspecial?.honReceberForte ?? 0, c: "border-emerald-600/50 text-emerald-900" },
              { k: "Hon. médio", v: stats.kpiEspecial?.honReceberMedio ?? 0, c: "border-emerald-500/40 text-emerald-800" },
              { k: "Teor fraco", v: stats.kpiEspecial?.teorFraco ?? 0, c: "border-orange-500/40 text-orange-900" },
              { k: "Em cumprimento", v: stats.kpiEspecial?.emCumprimento ?? 0, c: "border-amber-500/40 text-amber-900" },
              { k: "Bloqueados", v: stats.kpiEspecial?.bloqueados ?? 0, c: "border-slate-400/40 text-slate-700" },
            ].map((x) => (
              <div key={x.k} className={cn("rounded-xl border bg-card/80 px-3 py-2", x.c)}>
                <p className="text-[8px] font-black uppercase tracking-wider opacity-70">{x.k}</p>
                <p className="text-xl font-black tabular-nums tracking-tighter">{x.v}</p>
              </div>
            ))}
          </div>
        </div>

        {stats.conflitos > 0 && (
          <div className="mx-4 sm:mx-6 mt-2 rounded-xl border-2 border-red-600/40 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-red-900 dark:text-red-100">
              {stats.conflitos} processo(s) com flags conflitantes (pendente instaurar + já em cumprimento).
              Use o filtro &quot;Flags em conflito&quot; e rode <strong>Reclassificar local</strong> para limpar.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[10px] font-black uppercase border-red-600 text-red-800"
              onClick={() => setFiltro("conflito")}
            >
              Ver conflitos
            </Button>
          </div>
        )}

        {manualStatus === "running" && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-xl border-2 border-amber-600/40 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="animate-spin text-amber-700 shrink-0" size={16} />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-amber-950 tracking-wide">
                  Scanner cumprimento · DataJud ∪ DJEN
                </p>
                <p className="text-[10px] text-amber-900/70 truncate">
                  {manualDone}/{manualTotal || "…"} · escopo {scanScope} · a lista atualiza ao finalizar
                </p>
              </div>
            </div>
            <Badge className="bg-amber-600 text-white text-[9px] font-black uppercase">Ao vivo</Badge>
          </div>
        )}


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
                  { key: "especial" as FiltroAtivo, label: "★ Versão Especial", icon: Sparkles, count: (stats.kpiEspecial?.prontoParceiro || 0) + (stats.kpiEspecial?.honReceberForte || 0), color: "text-violet-900" },
                  { key: "parceiro" as FiltroAtivo, label: "Empresa por fora", icon: Scale, count: stats.parceiro || 0, color: "text-violet-700" },
                  { key: "hon_receber" as FiltroAtivo, label: "Honorários a receber", icon: Scale, count: stats.honReceber || 0, color: "text-emerald-700" },
                  { key: "honorarios" as FiltroAtivo, label: `Score ≥${limiar}`, icon: AlertTriangle, count: stats.honorarios, color: "text-violet-600" },
                  { key: "conflito" as FiltroAtivo, label: "Flags em conflito", icon: ShieldAlert, count: stats.conflitos || 0, color: "text-red-700" },
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

          {/* Lista principal · Lote 9 lista | kanban */}
          <section className="lg:col-span-9 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {filtered.length} na fila · vista
              </p>
              <div className="flex rounded-lg border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setVista("lista")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-wide",
                    vista === "lista" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setVista("kanban")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-wide",
                    vista === "kanban" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Kanban
                </button>
              </div>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                {cases.length === 0
                  ? "Nenhum caso com procedência ou cumprimento detectado. Use “Varrer só cumprimento” (DataJud+DJEN) ou o scanner em escopo Cumprimento. Depois Reclassificar se precisar."
                  : "Nenhum caso para este filtro."}
              </div>
            ) : vista === "kanban" ? (
              <ScrollArea className="flex-1">
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
                  {(["pronto_parceiro", "hon_receber", "teor_ok", "triagem", "em_cumprimento", "bloqueado"] as const).map((key) => {
                    const col = kanbanCols[key];
                    if (!col) return null;
                    return (
                      <div key={key} className={cn("rounded-xl border p-2 space-y-2 min-h-[120px]", col.color)}>
                        <div className="flex items-center justify-between gap-1 px-1">
                          <p className="text-[10px] font-black uppercase tracking-wide truncate">{col.title}</p>
                          <Badge variant="outline" className="text-[9px] font-black tabular-nums shrink-0">
                            {col.items.length}
                          </Badge>
                        </div>
                        <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
                          {col.items.length === 0 && (
                            <p className="text-[10px] text-muted-foreground px-1 py-4 text-center">—</p>
                          )}
                          {col.items.map((c) => {
                            let rkLabel = "";
                            try {
                              const rk = rankearCasoEspecial(c, limiar);
                              rkLabel = rk.label;
                            } catch {
                              rkLabel = "";
                            }
                            return (
                              <button
                                key={c.protocolo || c.id}
                                type="button"
                                onClick={() => {
                                  setExpandedProto(c.protocolo);
                                  setVista("lista");
                                  setFiltro("todos");
                                  setQ(String(c.protocolo || ""));
                                }}
                                className="w-full text-left rounded-lg border border-border/50 bg-card px-2.5 py-2 hover:border-primary/40 transition-colors"
                              >
                                <p className="text-[11px] font-black uppercase truncate">{c.cliente}</p>
                                <p className="text-[10px] font-mono tabular-nums text-muted-foreground truncate">{c.protocolo}</p>
                                {rkLabel && (
                                  <p className="text-[9px] font-semibold text-foreground/80 mt-0.5 truncate">{rkLabel}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
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
                            <button
                              type="button"
                              onClick={() => void copyProtocolo(String(c.protocolo || ""))}
                              className="group flex items-center gap-1.5 max-w-full text-left"
                              title="Copiar CNJ"
                            >
                              <span className="text-[13px] sm:text-sm font-mono font-bold tabular-nums tracking-tight text-foreground truncate">
                                {c.protocolo}
                              </span>
                              {copiedProto === c.protocolo ? (
                                <Check size={14} className="text-emerald-600 shrink-0" />
                              ) : (
                                <Copy size={14} className="opacity-40 group-hover:opacity-100 shrink-0" />
                              )}
                            </button>
                            {(() => {
                              const op = oportunidadeOf(c);
                              if (!op || op.score <= 0) return null;
                              const hot = op.elegivel && op.score >= limiar;
                              return (
                                <p className={cn(
                                  "text-[11px] font-semibold mt-0.5",
                                  hot ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
                                )}>
                                  Score {op.score}/{limiar}
                                  {op.tipo && op.tipo !== "incerto" ? ` · ${op.tipo}` : ""}
                                  {hot ? " · acima do limiar (honorários)" : op.elegivel ? " · elegível (abaixo do limiar)" : ""}
                                  {op.riscos?.[0] ? ` · ${op.riscos[0].slice(0, 60)}` : ""}
                                </p>
                              );
                            })()}
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
                              // Lote 8.1 — estágio comercial (honorários a receber)
                              try {
                                const rk = rankearCasoEspecial(c, limiar);
                                if (
                                  rk.estagio === "pronto_parceiro" ||
                                  rk.estagio === "hon_receber" ||
                                  rk.honorariosNivel === "forte" ||
                                  rk.honorariosNivel === "medio"
                                ) {
                                  return (
                                    <Badge
                                      className={
                                        rk.estagio === "pronto_parceiro"
                                          ? "bg-violet-700 text-[8px] font-black uppercase"
                                          : rk.honorariosNivel === "forte"
                                            ? "bg-emerald-700 text-[8px] font-black uppercase"
                                            : "bg-emerald-600/90 text-[8px] font-black uppercase"
                                      }
                                      title={rk.motivos?.slice(0, 3).join(" · ") || rk.label}
                                    >
                                      {rk.estagio === "pronto_parceiro"
                                        ? "★ Pronto parceiro"
                                        : rk.honorariosNivel === "forte"
                                          ? "Hon. a receber · forte"
                                          : "Hon. a receber · médio"}
                                    </Badge>
                                  );
                                }
                                if (rk.estagio === "bloqueado" || rk.honorariosNivel === "bloqueado") {
                                  return (
                                    <Badge className="bg-slate-600 text-[8px] font-black uppercase" title="Sucumbência recíproca / a cargo do autor">
                                      Hon. bloqueados
                                    </Badge>
                                  );
                                }
                              } catch {
                                /* ignore */
                              }
                              return null;
                            })()}
                            {(() => {
                              const op = oportunidadeOf(c);
                              if (!op || op.score <= 0) return null;
                              const hot = op.elegivel && op.score >= limiar;
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
                            const mp = (c as any).dados?.motor_parados || (c as any).motor_parados;
                            if (mp?.score_acao != null) {
                              return (
                                <span className="text-violet-700 dark:text-violet-300">
                                  Parados score {mp.score_acao}
                                  {mp.dias_parado_tribunal != null ? ` · ${mp.dias_parado_tribunal}d trib.` : ""}
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

                        {(() => {
                          const blobC = blobDoCaso(c);
                          const disp = extrairDispositivoBullets(blobC);
                          const credito = extrairCreditoSentenca(blobC);
                          const op = oportunidadeOf(c);
                          const ctr = contratoByProto[String(c.protocolo)];
                          const chk = checklistByProto[String(c.protocolo)] || loadChecklist(String(c.protocolo));
                          const open = expandedProto === c.protocolo;
                          // Lote5: teor ampliado no scan conta como índice OK (não “fraco”)
                          const teorOkUi = disp.teorOk || !!op?.teorIndiceOk;
                          const podeR$ = podeExibirValorMonetario({
                            teorSentencaOk: teorOkUi && (disp.temQuantia || disp.temHonorariosReu || !!op?.elegivel),
                            contratoCamposMinimos: !!ctr?.camposMinimos,
                            aprovadoHumano: chk.revisadoHumano === true,
                          });
                          return (
                            <div className="space-y-2 pt-1">
                              {disp.encontroContas && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-2 text-[11px] text-amber-950 dark:text-amber-100">
                                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                                  <span className="font-semibold">
                                    Encontro de contas / compensação possível — não prometa depósito em conta.
                                  </span>
                                </div>
                              )}
                              <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                  O que o juiz determinou
                                  {!teorOkUi && op?.precisaEnriquecer && (
                                    <span className="ml-2 text-orange-600 normal-case font-bold">· teor fraco</span>
                                  )}
                                  {teorOkUi && op?.teorSemCredito && (
                                    <span className="ml-2 text-slate-600 normal-case font-bold">· índice ampliado · sem quantia/sucumbência detectável</span>
                                  )}
                                  {teorOkUi && !op?.teorSemCredito && disp.teorOk && (
                                    <span className="ml-2 text-emerald-700 normal-case font-bold">· teor ok</span>
                                  )}
                                </p>
                                {!teorOkUi && op?.precisaEnriquecer && (
                                  <p className="text-[10px] text-orange-800 dark:text-orange-200">
                                    Teor ainda fraco — o próximo &quot;Varrer só cumprimento&quot; amplia DJEN (2 anos) + DataJud automaticamente.
                                  </p>
                                )}
                                {disp.bullets.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {op?.teorSemCredito
                                      ? "Teor lido; dispositivo sem quantia/honorários explícitos no índice."
                                      : "Sem dispositivo legível no índice."}
                                  </p>
                                ) : (
                                  <ul className="list-disc pl-4 space-y-0.5">
                                    {disp.bullets.map((b, i) => (
                                      <li key={i} className="text-[11px] leading-snug text-foreground/90">{b}</li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {disp.temQuantia && (
                                    <Badge className="bg-emerald-700 text-[8px] font-black uppercase">Quantia</Badge>
                                  )}
                                  {disp.temHonorariosReu && (
                                    <Badge className="bg-violet-700 text-[8px] font-black uppercase">Honorários réu</Badge>
                                  )}
                                  {credito.honorariosAReceber && (
                                    <Badge className={
                                      credito.honorariosNivel === "forte"
                                        ? "bg-emerald-700 text-[8px] font-black uppercase"
                                        : credito.honorariosNivel === "medio"
                                          ? "bg-emerald-600/90 text-[8px] font-black uppercase"
                                          : "bg-amber-600 text-[8px] font-black uppercase"
                                    }>
                                      Honorários a receber
                                      {credito.honorariosNivel === "forte" ? " · forte" : credito.honorariosNivel === "medio" ? " · médio" : ""}
                                    </Badge>
                                  )}
                                  {credito.honorariosNivel === "bloqueado" && (
                                    <Badge className="bg-slate-600 text-[8px] font-black uppercase">Hon. bloqueados</Badge>
                                  )}
                                  {credito.art523 && (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-blue-500/50 text-blue-800">Art. 523</Badge>
                                  )}
                                  {credito.honorariosPercentual != null && (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                                      Hon. {credito.honorariosPercentual}%
                                    </Badge>
                                  )}
                                  {credito.valoresDetectados.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] font-black uppercase border-emerald-600/40"
                                      title="Valores citados no teor — NÃO usar como promessa sem revisão"
                                    >
                                      R$ no teor ({credito.valoresDetectados.length})
                                    </Badge>
                                  )}
                                  {op?.tipo && op.tipo !== "incerto" && (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                                      Crédito: {op.tipo}
                                    </Badge>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[9px] font-black uppercase"
                                    onClick={() => {
                                      const txt = scriptWhatsAppAposTeor({
                                        nome: c.cliente || "Cliente",
                                        protocolo: String(c.protocolo || ""),
                                        tipo: op?.tipo,
                                        art523: credito.art523,
                                        encontroContas: credito.encontroContas || disp.encontroContas,
                                        jaEmCumprimento: statusExecutivo(c) === "ativo",
                                      });
                                      void navigator.clipboard.writeText(txt);
                                      toast({ title: "Script WhatsApp copiado", description: "Sem valor em R$ — revisar antes de enviar" });
                                    }}
                                  >
                                    Copiar WhatsApp
                                  </Button>
                                  {!podeR$ && (
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] font-black uppercase border-red-400 text-red-700"
                                      title="R$ só após teor + contrato + revisão humana — nunca promete valor só pelo índice"
                                    >
                                      R$ bloqueado
                                    </Badge>
                                  )}
                                </div>
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
                                <label className="inline-flex">
                                  <input
                                    type="file"
                                    accept=".pdf,image/*,.txt,.md"
                                    className="hidden"
                                    disabled={contratoBusy === c.protocolo}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0] || null;
                                      void handleAnexoContrato(String(c.protocolo), f);
                                      e.target.value = "";
                                    }}
                                  />
                                  <span
                                    className={cn(
                                      "inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[10px] font-semibold cursor-pointer hover:bg-muted",
                                      contratoBusy === c.protocolo && "opacity-50 pointer-events-none"
                                    )}
                                  >
                                    {contratoBusy === c.protocolo ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <Paperclip size={10} />
                                    )}
                                    Anexar contrato
                                  </span>
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 rounded-lg text-[10px] gap-1"
                                  onClick={() =>
                                    setExpandedProto(open ? null : String(c.protocolo))
                                  }
                                >
                                  <ListChecks size={10} />
                                  Vale a pena?
                                </Button>
                                {casePhone(c) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 rounded-lg text-[10px] gap-1"
                                    onClick={() =>
                                      openWhatsAppClient({
                                        phone: casePhone(c),
                                        text: scriptWhatsAppCumprimentoSemValor(
                                          String(c.cliente || ""),
                                          String(c.protocolo || "")
                                        ),
                                      })
                                    }
                                  >
                                    <ExternalLink size={10} /> WhatsApp
                                  </Button>
                                )}
                              </div>

                              {ctr && (
                                <div className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] space-y-1">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                    Contrato ({ctr.provider || "ocr"}) · conf. {ctr.campos.confianca}%
                                  </p>
                                  <p>Valor: <strong>{ctr.campos.valorFinanciado || "—"}</strong></p>
                                  <p>Taxa: <strong>{ctr.campos.taxaJuros || "—"}</strong> · CET: <strong>{ctr.campos.cet || "—"}</strong></p>
                                  <p>Prazo: <strong>{ctr.campos.prazoMeses || "—"}</strong> meses</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[9px] font-black uppercase"
                                    onClick={() => {
                                      const txt = scriptWhatsAppAposTeor({
                                        nome: c.cliente || "Cliente",
                                        protocolo: String(c.protocolo || ""),
                                        tipo: op?.tipo,
                                        art523: credito.art523,
                                        encontroContas: credito.encontroContas || disp.encontroContas,
                                        jaEmCumprimento: statusExecutivo(c) === "ativo",
                                      });
                                      void navigator.clipboard.writeText(txt);
                                      toast({ title: "Script WhatsApp copiado", description: "Sem valor em R$ — revisar antes de enviar" });
                                    }}
                                  >
                                    Copiar WhatsApp
                                  </Button>
                                  {!podeR$ && (
                                    <p className="text-red-700 font-semibold text-[10px]">
                                      Hard block: não exibir R$ ao cliente até teor OK + campos mínimos + revisão humana.
                                    </p>
                                  )}
                                </div>
                              )}

                              {open && (
                                <div className="rounded-lg border border-border bg-card px-2.5 py-2 space-y-1.5">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                    <ListChecks size={12} /> Checklist · vale instaurar?
                                    {checklistAprovado(chk) && (
                                      <Badge className="ml-2 bg-emerald-600 text-[8px]">OK</Badge>
                                    )}
                                  </p>
                                  {(Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[]).map((key) => (
                                    <label
                                      key={key}
                                      className="flex items-start gap-2 text-[11px] cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={chk[key] === true}
                                        onChange={() => toggleChecklist(String(c.protocolo), key)}
                                      />
                                      <span>{CHECKLIST_LABELS[key]}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {open && (
                                <div className="rounded-lg border border-violet-600/30 bg-violet-500/5 px-2.5 py-2 space-y-2">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-900 dark:text-violet-200">
                                    Liquidação · Lexis + handoff Legalcloud
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Simulação interna (art. 85 / 523). Não inventa principal — digite ou use referência do teor.
                                    Índices oficiais: confirme no Legalcloud Premium.
                                  </p>
                                  {(() => {
                                    const proto = String(c.protocolo || "");
                                    const liq = liqByProto[proto] || {
                                      principal: credito.valoresDetectados?.[0] ? String(credito.valoresDetectados[0]).replace(/[^\d,.-]/g, "") : "",
                                      fator: "1",
                                      jurosAa: "0",
                                      abatimentos: "0",
                                      custas: "0",
                                      honPct: credito.honorariosPercentual != null ? String(credito.honorariosPercentual) : (credito.honorariosAReceber ? "10" : "0"),
                                      art523: true,
                                    };
                                    const setLiq = (patch: Partial<typeof liq>) =>
                                      setLiqByProto((prev) => ({ ...prev, [proto]: { ...liq, ...patch } }));
                                    const parseBR = (s: string) => {
                                      const t = String(s || "").trim().replace(/\./g, "").replace(",", ".");
                                      const v = parseFloat(t);
                                      return Number.isFinite(v) ? v : 0;
                                    };
                                    const sim = simularLiquidacaoCumprimento({
                                      valorPrincipal: parseBR(liq.principal),
                                      fatorCorrecao: parseBR(liq.fator) || 1,
                                      jurosAaPercent: parseBR(liq.jurosAa),
                                      abatimentos: parseBR(liq.abatimentos),
                                      custas: parseBR(liq.custas),
                                      honorariosConhecimentoPct: parseBR(liq.honPct) || null,
                                      aplicarArt523: !!liq.art523,
                                      dataBase: c.data_transito_julgado || null,
                                    });
                                    return (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                          {[
                                            ["principal", "Principal R$", liq.principal],
                                            ["fator", "Fator correção", liq.fator],
                                            ["jurosAa", "Juros % a.a.", liq.jurosAa],
                                            ["abatimentos", "Abatimentos", liq.abatimentos],
                                            ["custas", "Custas", liq.custas],
                                            ["honPct", "Hon. art.85 %", liq.honPct],
                                          ].map(([k, lab, val]) => (
                                            <label key={k} className="text-[10px] space-y-0.5">
                                              <span className="text-muted-foreground font-semibold">{lab}</span>
                                              <Input
                                                className="h-8 text-[11px]"
                                                value={String(val)}
                                                onChange={(e) => setLiq({ [k]: e.target.value } as any)}
                                              />
                                            </label>
                                          ))}
                                        </div>
                                        <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={!!liq.art523}
                                            onChange={(e) => setLiq({ art523: e.target.checked })}
                                          />
                                          Aplicar art. 523 §1º (multa 10% + hon. 10%)
                                        </label>
                                        {sim.erros.length > 0 && (
                                          <p className="text-[10px] text-red-700 font-semibold">{sim.erros[0]}</p>
                                        )}
                                        {sim.ok && (
                                          <div className="rounded border border-border/60 bg-card px-2 py-1.5 space-y-0.5">
                                            {sim.linhas.map((ln, i) => (
                                              <div key={i} className="flex justify-between text-[10px] tabular-nums">
                                                <span className={ln.label === "TOTAL SIMULADO" ? "font-black" : ""}>{ln.label}</span>
                                                <span className={ln.label === "TOTAL SIMULADO" ? "font-black text-violet-800" : ""}>
                                                  {formatBRL(ln.valor)}
                                                </span>
                                              </div>
                                            ))}
                                            <p className="text-[9px] text-amber-800 font-semibold pt-1">
                                              Uso interno · hard block ao cliente permanece até checklist + teor + revisão.
                                            </p>
                                          </div>
                                        )}
                                        {sim.avisos[0] && (
                                          <p className="text-[9px] text-muted-foreground">{sim.avisos[0]}</p>
                                        )}
                                        <div className="flex flex-wrap gap-1.5">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-[10px] h-8"
                                            onClick={() => {
                                              const h = buildHandoffLegalcloud({
                                                protocolo: proto,
                                                cliente: String(c.cliente || ""),
                                                valorPrincipal: parseBR(liq.principal) || null,
                                                dataBase: c.data_transito_julgado || null,
                                                honorariosPct: parseBR(liq.honPct) || null,
                                                aplicarArt523: !!liq.art523,
                                                observacoes: sim.ok ? `Total simulado Lexis: ${formatBRL(sim.total)}` : undefined,
                                              });
                                              void navigator.clipboard.writeText(handoffToClipboardText(h));
                                              toast({ title: "Handoff copiado", description: "Cole no Legalcloud ou no briefing da equipe." });
                                            }}
                                          >
                                            Copiar handoff Legalcloud
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="text-[10px] h-8"
                                            onClick={() => window.open(urlCalculadoraLegalcloud(), "_blank", "noopener,noreferrer")}
                                          >
                                            Abrir calculadora Legalcloud
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
