
"use client";

/**
 * Processos parados (com ação possível) v2 — reativação com estados sem_scan / confirmado.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import { useAdmin } from '@/hooks/use-admin';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn, formatWhatsAppLink } from "@/lib/utils";
import {
  Clock,
  Loader2,
  RefreshCcw,
  Search,
  MessageCircle,
  Copy,
  ExternalLink,
  PauseCircle,
  Filter,
  CheckCircle2,
  Database,
  Download,
} from "lucide-react";
import { fetchRepoCases, scanSingleCaseAction } from "@/app/actions/case-actions";
import type { LegalCase } from "@/lib/case-logic";
import {
  listProcessosParados,
  scriptProcessoParado,
  loadTratadosMap,
  saveTratado,
  clearTratado,
  type FaixaParado,
  type ProcessoParadoItem,
  type EstadoParado,
} from "@/lib/processos-parados";
import { loadCarteiraComCache } from "@/lib/session-carteira-cache";
import { listAdvogados } from "@/lib/case-filters";

const FAIXAS: { id: FaixaParado; label: string }[] = [
  { id: 30, label: "≥ 30 dias" },
  { id: 60, label: "≥ 60 dias" },
  { id: 90, label: "≥ 90 dias" },
  { id: 120, label: "≥ 120 dias" },
  { id: 180, label: "≥ 180 dias" },
];

type FiltroEstado = "todos" | "confirmados" | "sem_scan" | "tratados" | "pendentes";

export default function ProcessosParadosPage() {
  const { canScan, canCopy, canExport } = useAdmin();
  const [batchScanning, setBatchScanning] = useState(false);

  const { toast } = useToast();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [minDias, setMinDias] = useState<FaixaParado>(60);
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("pendentes");
  const [lawyerFilter, setLawyerFilter] = useState("ALL");
  const [somenteMeta, setSomenteMeta] = useState(true);
  const [dailyMeta, setDailyMeta] = useState(25);
  const [tratados, setTratados] = useState<Record<string, string>>({});
  const [onlyComTel, setOnlyComTel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadCarteiraComCache({
        fetchNetwork: async () => (await fetchRepoCases()) || [],
        onShow: (data) => {
          if (Array.isArray(data)) setCases(data);
        },
      });
      setTratados(loadTratadosMap());
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    try {
      const m = localStorage.getItem("lexis_parados_meta");
      if (m) setDailyMeta(Math.max(10, Math.min(100, parseInt(m, 10) || 25)));
      const s = localStorage.getItem("lexis_parados_somente_meta");
      if (s === "0") setSomenteMeta(false);
    } catch {
      /* */
    }
  }, [load]);

  const advogados = useMemo(() => listAdvogados(cases as any), [cases]);

  const listaBase = useMemo(() => {
    const items = listProcessosParados(cases, minDias, {
      includeSemScan: true,
      onlyConfirmados: false,
    }).map((i) => ({
      ...i,
      tratado: !!tratados[String(i.case.protocolo || "")],
    }));
    return items;
  }, [cases, minDias, tratados]);

  const lista = useMemo(() => {
    let items = listaBase;
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          String(i.case.cliente || "").toLowerCase().includes(q) ||
          String(i.case.protocolo || "").toLowerCase().includes(q) ||
          String(i.case.advogado || "").toLowerCase().includes(q)
      );
    }
    if (lawyerFilter !== "ALL") {
      const key = lawyerFilter.trim().toUpperCase();
      items = items.filter((i) => String(i.case.advogado || "").trim().toUpperCase() === key);
    }
    if (onlyComTel) {
      items = items.filter((i) => String(i.case.telefone || "").replace(/\D/g, "").length >= 10);
    }
    if (filtroEstado === "confirmados") {
      items = items.filter((i) => i.estado === "parado_confirmado" || i.estado === "parado_provavel");
    } else if (filtroEstado === "sem_scan") {
      items = items.filter((i) => i.estado === "sem_scan");
    } else if (filtroEstado === "tratados") {
      items = items.filter((i) => i.tratado);
    } else if (filtroEstado === "pendentes") {
      items = items.filter((i) => !i.tratado);
    }
    if (somenteMeta) items = items.slice(0, dailyMeta);
    return items;
  }, [listaBase, search, lawyerFilter, onlyComTel, filtroEstado, somenteMeta, dailyMeta]);

  const kpis = useMemo(() => {
    const all = listaBase;
    return {
      totalPend: all.filter((i) => !i.tratado).length,
      confirmados: all.filter((i) => i.estado !== "sem_scan" && !i.tratado).length,
      semScan: all.filter((i) => i.estado === "sem_scan" && !i.tratado).length,
      d90: all.filter((i) => i.estado !== "sem_scan" && i.diasParadoTribunal >= 90 && !i.tratado).length,
      tratados: all.filter((i) => i.tratado).length,
    };
  }, [listaBase]);

  const markTratado = (proto: string) => {
    saveTratado(proto);
    setTratados(loadTratadosMap());
    toast({ title: "Marcado como tratado", description: "Não some da carteira — só desta fila de parados." });
  };

  const unmarkTratado = (proto: string) => {
    clearTratado(proto);
    setTratados(loadTratadosMap());
  };

  const copyScript = (item: ProcessoParadoItem) => {
    const text = scriptProcessoParado(item.case, item.diasParadoTribunal, item.estado);
    navigator.clipboard.writeText(text);
    toast({ title: "Mensagem copiada", description: item.estado === "sem_scan" ? "Auditar antes de prometer andamento" : "Reativação / andamento" });
  };

  const exportCsv = () => {
    if (!canExport) {
      toast({ title: "Modo visualização", description: "Exportação bloqueada neste perfil.", variant: "destructive" });
      return;
    }
    const headers = ["cliente", "protocolo", "estado", "dias_parado", "fonte", "advogado", "telefone", "score", "tratado"];
    const lines = [headers.join(";")];
    for (const i of lista) {
      lines.push(
        [
          i.case.cliente,
          i.case.protocolo,
          i.estado,
          i.diasParadoTribunal,
          i.fonteData,
          i.case.advogado || "",
          i.case.telefone || "",
          i.scoreAcao,
          i.tratado ? "sim" : "nao",
        ]
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(";")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processos-parados-${minDias}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scanOne = async (protocolo: string) => {
    setScanning(protocolo);
    try {
      const res: any = await scanSingleCaseAction(protocolo, { mode: "both", fast: false } as any);
      if (res?.case) {
        setCases((prev) => prev.map((c) => (c.protocolo === protocolo ? { ...c, ...res.case } : c)));
        toast({ title: "Auditoria atualizada", description: protocolo });
      } else {
        toast({
          title: "Scan concluído",
          description: res?.message || res?.error || "Sem patch",
          variant: res?.success === false ? "destructive" : "default",
        });
      }
    } catch (e: any) {
      toast({ title: "Falha no scan", description: e?.message, variant: "destructive" });
    } finally {
      setScanning(null);
    }
  };

  const estadoBadge = (e: EstadoParado) => {
    if (e === "sem_scan")
      return <Badge className="bg-slate-600 text-white text-[9px] font-bold">SEM SCAN</Badge>;
    if (e === "parado_provavel")
      return <Badge className="bg-amber-200 text-amber-900 text-[9px] font-bold">PROVÁVEL</Badge>;
    return <Badge className="bg-amber-600 text-white text-[9px] font-bold">PARADO</Badge>;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="border-b border-border/60 bg-card/40 px-6 py-5 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <PauseCircle className="text-amber-600" size={22} />
                Processos parados
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Silêncio no tribunal ≠ prazo vencido. Separe quem precisa <strong>auditar</strong> de quem está{" "}
                <strong>parado de verdade</strong> e ainda cabe cobrança de andamento.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              
              <Button
                variant="secondary"
                size="sm"
                disabled={!canScan || batchScanning}
                onClick={async () => {
                  if (!canScan) {
                    toast({ title: "Modo visualização", description: "Scanner bloqueado neste perfil.", variant: "destructive" });
                    return;
                  }
                  const alvo = listProcessosParados(cases, minDias, { includeSemScan: false, onlyConfirmados: true })
                    .filter((i) => !tratados[String(i.case?.protocolo || "")])
                    .slice(0, 15);
                  if (!alvo.length) {
                    toast({ title: "Nada a auditar", description: "Sem parados acionáveis no processo nesta faixa." });
                    return;
                  }
                  setBatchScanning(true);
                  let ok = 0, fail = 0;
                  try {
                    for (const item of alvo) {
                      const p = String(item.case?.protocolo || "");
                      if (!p) continue;
                      try {
                        const res: any = await scanSingleCaseAction(p, { mode: "both", fast: false } as any);
                        if (res?.success !== false) ok++;
                        else fail++;
                      } catch {
                        fail++;
                      }
                      await new Promise((r) => setTimeout(r, 400));
                    }
                    toast({ title: "Lote de parados", description: `OK ${ok} · falhas ${fail} (máx. 15)` });
                    await load();
                  } finally {
                    setBatchScanning(false);
                  }
                }}
                className="gap-2"
              >
                {batchScanning ? "Auditando…" : "Auditar top 15 parados"}
              </Button>

              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!canExport} className="gap-2">
                <Download size={14} /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-black tabular-nums">{kpis.totalPend}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Parados (c/ data)</p>
              <p className="text-2xl font-black tabular-nums text-amber-700">{kpis.confirmados}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Sem scan</p>
              <p className="text-2xl font-black tabular-nums text-slate-600">{kpis.semScan}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">≥ 90 dias</p>
              <p className="text-2xl font-black tabular-nums text-red-700">{kpis.d90}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Tratados</p>
              <p className="text-2xl font-black tabular-nums text-emerald-700">{kpis.tratados}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Filter size={14} className="text-muted-foreground" />
              {FAIXAS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={minDias === f.id ? "default" : "outline"}
                  className="h-8 text-[10px] font-bold uppercase"
                  onClick={() => setMinDias(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {(
                [
                  ["pendentes", "Pendentes"],
                  ["confirmados", "Só parados"],
                  ["sem_scan", "Só sem scan"],
                  ["tratados", "Tratados"],
                  ["todos", "Todos"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={filtroEstado === id ? "secondary" : "ghost"}
                  className="h-8 text-[10px] font-bold uppercase"
                  onClick={() => setFiltroEstado(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cliente, CNJ ou advogado…"
                  className="pl-9 h-9"
                />
              </div>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium max-w-[220px]"
                value={lawyerFilter}
                onChange={(e) => setLawyerFilter(e.target.value)}
              >
                <option value="ALL">Todos os advogados</option>
                {advogados.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground cursor-pointer">
                <Checkbox checked={onlyComTel} onCheckedChange={(v) => setOnlyComTel(!!v)} />
                Só com telefone
              </label>
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={somenteMeta}
                  onCheckedChange={(v) => {
                    const on = !!v;
                    setSomenteMeta(on);
                    try {
                      localStorage.setItem("lexis_parados_somente_meta", on ? "1" : "0");
                    } catch {
                      /* */
                    }
                  }}
                />
                Só meta ({dailyMeta})
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    const n = Math.max(10, dailyMeta - 5);
                    setDailyMeta(n);
                    try {
                      localStorage.setItem("lexis_parados_meta", String(n));
                    } catch {
                      /* */
                    }
                  }}
                >
                  −
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    const n = Math.min(100, dailyMeta + 5);
                    setDailyMeta(n);
                    try {
                      localStorage.setItem("lexis_parados_meta", String(n));
                    } catch {
                      /* */
                    }
                  }}
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="animate-spin" /> Carregando carteira…
            </div>
          )}

          {!loading && lista.length === 0 && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              <Clock className="mx-auto mb-3 opacity-40" size={32} />
              <p className="font-semibold">Nada nesta combinação de filtros</p>
              <p className="text-sm mt-1">
                Reduza a faixa, inclua “Sem scan” ou desligue “Só meta”. Rode o scanner híbrido para preencher datas.
              </p>
            </div>
          )}

          {lista.map((item) => {
            const c = item.case;
            const tel = String(c.telefone || "").replace(/\D/g, "");
            const script = scriptProcessoParado(c, item.diasParadoTribunal, item.estado);
            return (
              <div
                key={c.protocolo}
                className={cn(
                  "rounded-2xl border bg-card p-4 sm:p-5 shadow-sm transition-colors",
                  item.tratado ? "opacity-60 border-emerald-200" : "hover:border-amber-300/60"
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-sm uppercase truncate max-w-[280px]">{c.cliente}</h2>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {c.protocolo}
                      </Badge>
                      {estadoBadge(item.estado)}
                      {item.estado !== "sem_scan" && (
                        <Badge
                          className={cn(
                            "text-[10px] font-bold",
                            item.diasParadoTribunal >= 180
                              ? "bg-red-600 text-white"
                              : item.diasParadoTribunal >= 90
                                ? "bg-amber-500 text-black"
                                : "bg-slate-200 text-slate-800"
                          )}
                        >
                          {item.diasParadoTribunal}d parado
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {item.fonteData}
                      </Badge>
                      {item.tratado && (
                        <Badge className="bg-emerald-600 text-white text-[9px]">TRATADO</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.ultimoSinalResumo}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.oportunidades.map((o, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 px-2 py-0.5 text-amber-900 dark:text-amber-100"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Advogado: {c.advogado || "—"} · Score: <strong>{item.scoreAcao}</strong>
                      {item.diasSemRetornoEquipe != null
                        ? ` · Sem retorno equipe: ${item.diasSemRetornoEquipe}d`
                        : " · Sem retorno registrado"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="secondary" className="h-9 gap-1.5" onClick={() => copyScript(item)}>
                      <Copy size={14} /> Mensagem
                    </Button>
                    {tel.length >= 10 && (
                      <Button size="sm" variant="outline" className="h-9 gap-1.5" asChild>
                        <a href={formatWhatsAppLink(tel, script)} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5"
                      disabled={scanning === c.protocolo}
                      onClick={() => scanOne(c.protocolo)}
                    >
                      {scanning === c.protocolo ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : item.estado === "sem_scan" ? (
                        <Database size={14} />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      {item.estado === "sem_scan" ? "Auditar" : "Rescan"}
                    </Button>
                    {!item.tratado ? (
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5" onClick={() => markTratado(c.protocolo)}>
                        <CheckCircle2 size={14} /> Tratado
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-muted-foreground" onClick={() => unmarkTratado(c.protocolo)}>
                        Desfazer
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-9 gap-1.5" asChild>
                      <Link href={`/cases?search=${encodeURIComponent(c.protocolo)}`}>
                        <ExternalLink size={14} /> Abrir
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
