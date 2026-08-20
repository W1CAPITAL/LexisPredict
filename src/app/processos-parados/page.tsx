"use client";

/**
 * Processos parados — sem movimentação no tribunal há N dias.
 * Foco: reativação, cobrança de andamento e oportunidade comercial/operacional.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertTriangle,
  PauseCircle,
  Filter,
} from "lucide-react";
import { fetchRepoCases, scanSingleCaseAction } from "@/app/actions/case-actions";
import type { LegalCase } from "@/lib/case-logic";
import {
  listProcessosParados,
  scriptProcessoParado,
  type FaixaParado,
  type ProcessoParadoItem,
} from "@/lib/processos-parados";
import { loadCarteiraComCache } from "@/lib/session-carteira-cache";

const FAIXAS: { id: FaixaParado; label: string }[] = [
  { id: 30, label: "≥ 30 dias" },
  { id: 60, label: "≥ 60 dias" },
  { id: 90, label: "≥ 90 dias" },
  { id: 120, label: "≥ 120 dias" },
  { id: 180, label: "≥ 180 dias" },
];

export default function ProcessosParadosPage() {
  const { toast } = useToast();
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [minDias, setMinDias] = useState<FaixaParado>(60);
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadCarteiraComCache({
        fetchNetwork: async () => (await fetchRepoCases()) || [],
        onShow: (data) => {
          if (Array.isArray(data)) setCases(data);
        },
      });
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const lista = useMemo(() => {
    let items = listProcessosParados(cases, minDias);
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          String(i.case.cliente || "").toLowerCase().includes(q) ||
          String(i.case.protocolo || "").toLowerCase().includes(q) ||
          String(i.case.advogado || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [cases, minDias, search]);

  const kpis = useMemo(() => {
    const total = lista.length;
    const d90 = lista.filter((i) => i.diasParadoTribunal >= 90).length;
    const d180 = lista.filter((i) => i.diasParadoTribunal >= 180).length;
    const semTel = lista.filter((i) => !String(i.case.telefone || "").replace(/\\D/g, "")).length;
    return { total, d90, d180, semTel };
  }, [lista]);

  const copyScript = (item: ProcessoParadoItem) => {
    const text = scriptProcessoParado(item.case, item.diasParadoTribunal);
    navigator.clipboard.writeText(text);
    toast({ title: "Mensagem copiada", description: "Tom leigo · reativação / andamento" });
  };

  const scanOne = async (protocolo: string) => {
    setScanning(protocolo);
    try {
      const res: any = await scanSingleCaseAction(protocolo, { mode: "both", fast: false } as any);
      if (res?.case) {
        setCases((prev) =>
          prev.map((c) => (c.protocolo === protocolo ? { ...c, ...res.case } : c))
        );
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="border-b border-border/60 bg-card/40 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                <PauseCircle className="text-amber-600" size={22} />
                Processos parados
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Ativos sem movimentação no tribunal há tempo. Úteis para cobrar andamento,
                alinhar o cliente e reativar a carteira — sem confundir com prazo vencido de atendimento.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
              Atualizar
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Nesta faixa</p>
              <p className="text-2xl font-black tabular-nums">{kpis.total}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">≥ 90 dias</p>
              <p className="text-2xl font-black tabular-nums text-amber-700">{kpis.d90}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">≥ 180 dias</p>
              <p className="text-2xl font-black tabular-nums text-red-700">{kpis.d180}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Sem telefone</p>
              <p className="text-2xl font-black tabular-nums">{kpis.semTel}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, CNJ ou advogado…"
                className="pl-9 h-9"
              />
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
              <p className="font-semibold">Nenhum processo parado nesta faixa</p>
              <p className="text-sm mt-1">
                Reduza o filtro (ex.: ≥ 30 dias) ou rode o scanner para atualizar datas de movimento.
              </p>
            </div>
          )}

          {lista.map((item) => {
            const c = item.case;
            const tel = String(c.telefone || "").replace(/\\D/g, "");
            const script = scriptProcessoParado(c, item.diasParadoTribunal);
            return (
              <div
                key={c.protocolo}
                className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm hover:border-amber-300/60 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-sm uppercase truncate max-w-[280px]">{c.cliente}</h2>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {c.protocolo}
                      </Badge>
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
                        {item.diasParadoTribunal >= 900 ? "Sem data" : `${item.diasParadoTribunal}d parado`}
                      </Badge>
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {item.fonteData}
                      </Badge>
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
                      Advogado: {c.advogado || "—"} · Escritório: {c.escritorio || "—"} · Score ação:{" "}
                      <strong>{item.scoreAcao}</strong>
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
                        <a
                          href={formatWhatsAppLink(tel, script)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      Auditar
                    </Button>
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
