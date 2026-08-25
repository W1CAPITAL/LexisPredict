"use client";

/**
 * Fila Encerrados a revisar — mesma lógica operacional da fila de contato,
 * especializada em encerramentos que ainda exigem o fino humano.
 */
import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchRepoCases } from "@/app/actions/case-actions";
import { saveOneCaseAction } from "@/app/actions/case-save-actions";
import { loadCarteiraComCache, invalidateCarteiraCache } from "@/lib/session-carteira-cache";
import { fetchCarteiraDeduped } from "@/lib/carteira-fetch-client";
import {
  buildFilaEncerradosRevisao,
  type ItemEncerradoRevisao,
} from "@/lib/encerrados-revisao";
import type { LegalCase } from "@/lib/case-logic";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/responsive-ui";
import {
  ShieldAlert,
  RefreshCcw,
  Search,
  Eye,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const toneClass: Record<string, string> = {
  critico: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  alto: "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  medio: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  info: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

type FiltroFlag =
  | "todos"
  | "procedente"
  | "cumprimento"
  | "restore"
  | "novidade"
  | "tribunal"
  | "confirmar";

export default function EncerradosRevisaoPage() {
  const { toast } = useToast();
  const { profile } = useAuth() as any;
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<FiltroFlag>("todos");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empId = profile?.empresa_id || null;
      const pack = await loadCarteiraComCache({
        fetchNetwork: async () => (await fetchCarteiraDeduped(() => fetchRepoCases())) || [],
        empresaId: empId,
        onShow: (data) => {
          if (Array.isArray(data)) startTransition(() => setCases(data as LegalCase[]));
        },
        allowStaleKpiFallback: false,
      });
      if (Array.isArray(pack.cases)) setCases(pack.cases as LegalCase[]);
    } catch (e: any) {
      toast({
        title: "Falha ao carregar carteira",
        description: e?.message || "Erro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.empresa_id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filaBase = useMemo(
    () => buildFilaEncerradosRevisao(cases, 500),
    [cases]
  );

  const fila = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filaBase.filter((it) => {
      if (filtro === "procedente" && !it.flags.some((f) => f.id === "procedente" || f.id === "parcial"))
        return false;
      if (filtro === "cumprimento" && !it.flags.some((f) => f.id === "cumprimento" || f.id === "instaurar"))
        return false;
      if (filtro === "restore" && !it.flags.some((f) => f.id === "restore")) return false;
      if (filtro === "novidade" && !it.flags.some((f) => f.id === "novidade")) return false;
      if (filtro === "tribunal" && !it.flags.some((f) => f.id === "baixa_tj")) return false;
      if (filtro === "confirmar" && !it.podeConfirmarAuto) return false;
      if (!q) return true;
      const c = it.case;
      const blob = `${c.cliente || ""} ${c.protocolo || ""} ${it.motivoPrincipal}`.toLowerCase();
      return blob.includes(q);
    });
  }, [filaBase, filtro, search]);

  const kpis = useMemo(() => {
    const all = filaBase;
    return {
      total: all.length,
      critico: all.filter((i) => i.flags.some((f) => f.tone === "critico")).length,
      confirmar: all.filter((i) => i.podeConfirmarAuto).length,
      cumprimento: all.filter((i) => i.flags.some((f) => f.id === "cumprimento" || f.id === "instaurar")).length,
      procedente: all.filter((i) => i.flags.some((f) => f.id === "procedente" || f.id === "parcial")).length,
    };
  }, [filaBase]);

  const reabrir = async (it: ItemEncerradoRevisao) => {
    const c = it.case;
    const id = String(c.id || c.protocolo);
    setBusyId(id);
    try {
      const res = await saveOneCaseAction({
        ...c,
        situacao: "EM ANDAMENTO",
        statusManual: "Automatico",
        viaEncerrarHumano: false,
        _situacaoAnterior: c.situacao,
        reopen_reason: "revisao-fila-encerrados",
      } as any);
      if (!res.success) {
        toast({ title: "Não reabriu", description: res.message, variant: "destructive" });
        return;
      }
      toast({ title: "Reaberto", description: c.protocolo });
      invalidateCarteiraCache();
      await loadData();
    } finally {
      setBusyId(null);
    }
  };

  const confirmarEncerrado = async (it: ItemEncerradoRevisao) => {
    const c = it.case;
    if (!it.podeConfirmarAuto) {
      toast({
        title: "Não confirme às cegas",
        description: "Há procedente/cumprimento/novidade — revise no processo.",
        variant: "destructive",
      });
      return;
    }
    const id = String(c.id || c.protocolo);
    setBusyId(id);
    try {
      const res = await saveOneCaseAction({
        ...c,
        situacao: "ENCERRADO",
        statusManual: "Encerrado",
        viaEncerrarHumano: true,
        forceMesmoComValor: false,
        _situacaoAnterior: c.situacao || "EM ANDAMENTO",
        revisao_encerrado_confirmada_em: new Date().toISOString(),
      } as any);
      if (!res.success) {
        toast({ title: "Falha ao confirmar", description: res.message, variant: "destructive" });
        return;
      }
      toast({ title: "Encerrado confirmado", description: c.protocolo });
      invalidateCarteiraCache();
      await loadData();
    } finally {
      setBusyId(null);
    }
  };

  const filtros: { id: FiltroFlag; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "critico" as any, label: "Críticos" },
    { id: "procedente", label: "Procedente" },
    { id: "cumprimento", label: "Cumprimento" },
    { id: "restore", label: "Restore sistema" },
    { id: "novidade", label: "Novidade" },
    { id: "tribunal", label: "Só tribunal" },
    { id: "confirmar", label: "Pode confirmar" },
  ];

  // fix critico filter - I used invalid type. Handle in filter:
  const filaFinal = useMemo(() => {
    if ((filtro as string) === "critico") {
      return fila.filter((it) => it.flags.some((f) => f.tone === "critico"));
    }
    return fila;
  }, [fila, filtro]);

  return (
    <div className="ops-ui admin-ui flex h-screen bg-background font-sans text-foreground overflow-hidden">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col h-screen overflow-hidden", ui.main)}>
        <header className="admin-page-header shrink-0 border-b border-border/40 px-4 sm:px-8 py-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-600/30 flex items-center justify-center">
                <ShieldAlert className="text-amber-700 dark:text-amber-400" size={20} />
              </div>
              <div>
                <h1 className="font-black text-base sm:text-xl uppercase tracking-tight">
                  Encerrados a revisar
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Fila de segurança · mesmo espírito da fila de contato · fino humano
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl font-black uppercase text-[9px] tracking-widest">
                <Link href="/tarefas">
                  <ListTodo size={14} className="mr-1.5" /> Fila de contato
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl font-black uppercase text-[9px] tracking-widest"
                onClick={() => loadData()}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                <span className="ml-1.5">Atualizar</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { l: "Na fila", v: kpis.total, c: "text-foreground" },
              { l: "Críticos", v: kpis.critico, c: "text-red-600" },
              { l: "Procedente", v: kpis.procedente, c: "text-orange-600" },
              { l: "Cumprimento", v: kpis.cumprimento, c: "text-amber-700" },
              { l: "Pode confirmar", v: kpis.confirmar, c: "text-emerald-600" },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{k.l}</p>
                <p className={cn("text-xl font-black tabular-nums", k.c)}>{loading ? "…" : k.v}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente ou CNJ…"
                className="h-10 pl-9 rounded-xl font-medium"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filtros.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id as FiltroFlag)}
                  className={cn(
                    "h-8 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-colors",
                    filtro === f.id
                      ? "bg-amber-600 text-white border-amber-700"
                      : "bg-card border-border/60 text-muted-foreground hover:border-amber-500/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading && cases.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
              <Loader2 className="animate-spin" size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Carregando carteira…</span>
            </div>
          ) : filaFinal.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 p-10 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600 mb-3" size={28} />
              <p className="text-[12px] font-black uppercase tracking-widest">Fila limpa neste filtro</p>
              <p className="text-[10px] text-muted-foreground mt-2 max-w-md mx-auto">
                Nenhum encerrado com os critérios de risco selecionados. Improcedente limpo sem cumprimento
                não polui esta fila.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card/40">
              <table className="w-full text-left min-w-[720px]">
                <thead className="bg-secondary/50 border-b border-border/30">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 sm:px-6 py-3">Prioridade</th>
                    <th className="px-4 py-3">Cliente / CNJ</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/15">
                  {filaFinal.map((it) => {
                    const c = it.case;
                    const id = String(c.id || c.protocolo);
                    const busy = busyId === id;
                    return (
                      <tr key={id} className="hover:bg-amber-500/5 transition-colors">
                        <td className="px-4 sm:px-6 py-3">
                          <span className="text-[11px] font-black tabular-nums text-amber-800 dark:text-amber-300">
                            {it.score}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-black uppercase">{c.cliente || "—"}</span>
                            <span className="text-[8px] font-mono opacity-50">{c.protocolo}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-200">
                            {it.motivoPrincipal}
                          </p>
                          {it.podeConfirmarAuto ? (
                            <p className="text-[8px] font-bold uppercase text-emerald-700 mt-1">
                              Pode confirmar (improcedente limpo)
                            </p>
                          ) : (
                            <p className="text-[8px] font-bold uppercase text-red-700 mt-1">
                              Não arquivo cego — passar o fino
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {it.flags.map((f) => (
                              <span
                                key={f.id}
                                className={cn(
                                  "text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border",
                                  toneClass[f.tone] || toneClass.info
                                )}
                              >
                                {f.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest"
                            >
                              <Link href={`/processos?search=${encodeURIComponent(c.protocolo || "")}`}>
                                <Eye size={12} className="mr-1" /> Revisar
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest"
                              onClick={() => reabrir(it)}
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} className="mr-1" />}
                              Reabrir
                            </Button>
                            {it.podeConfirmarAuto && (
                              <Button
                                size="sm"
                                disabled={busy}
                                className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-700 hover:bg-emerald-800 text-white"
                                onClick={() => confirmarEncerrado(it)}
                              >
                                <CheckCircle2 size={12} className="mr-1" /> Confirmar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ArrowRight size={12} />
            Visão da empresa e edição ampla: /processos · Esta fila usa a carteira do usuário logado
          </p>
        </div>
      </main>
    </div>
  );
}
