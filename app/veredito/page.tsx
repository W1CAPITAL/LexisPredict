"use client";

/**
 * Consulta de processo — SEM fetch DataJud no browser (evita CORS).
 * Tudo via server actions.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Search,
  Loader2,
  AlertCircle,
  Info,
  Copyright,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { executarVereditoAI } from "@/ai/flows/veredito-ai-flow";
import {
  searchProcessesByCpfAction,
  searchProcessesByNomeAction,
  enrichProcessTimelineAction,
} from "@/app/actions/search-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DataJudDisclaimer } from "@/components/ui/datajud-disclaimer";

type SearchHit = {
  origem?: string;
  numeroProcesso: string;
  classe?: string | null;
  poloAtivo?: string[];
  poloPassivo?: string[];
  tribunal?: string | null;
  grau?: string | null;
  isBuscaApreensao?: boolean;
  cliente?: string;
  aviso?: string;
};

export default function VereditoPage() {
  const [cnj, setCnj] = useState("");
  const [searchMode, setSearchMode] = useState<"cnj" | "cpf" | "nome">("cnj");
  const [cpfQuery, setCpfQuery] = useState("");
  const [nomeQuery, setNomeQuery] = useState("");
  const [listaResultados, setListaResultados] = useState<SearchHit[]>([]);
  const [filtroBA, setFiltroBA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [model, setModel] = useState("xai");
  const [apiError, setApiError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    isMounted.current = true;
    const saved = localStorage.getItem("lexisPredict_preferred_ia") || "xai";
    setModel(saved === "airforce" ? "xai" : saved);
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** CNJ: server-only DataJud + DJEN + parecer */
  const runVereditoForCnj = async (numero: string) => {
    const proto = String(numero || "").trim();
    if (!proto) return;

    setCnj(proto);
    setListaResultados([]);
    setLoading(true);
    setResult(null);
    setApiError(null);

    try {
      const timeline = await enrichProcessTimelineAction(proto).catch(() => ({
        success: false,
        movimentos: [] as any[],
        comunicacoes: [] as any[],
        fonte: "nenhuma" as const,
        message: "Falha ao carregar timeline.",
      }));

      let data: any = null;
      try {
        data = await executarVereditoAI({ cnj: proto, preferredModel: model });
      } catch {
        data = null;
      }

      if (!isMounted.current) return;

      const hasTimeline = !!(timeline && timeline.success && (timeline.movimentos?.length || 0) > 0);
      const hasAi = !!(data && (data.success || data.dataJudRaw));

      if (!hasTimeline && !hasAi) {
        const msg =
          (timeline && timeline.message) ||
          (data && data.message) ||
          "CNJ sem movimentos no DataJud/DJEN.";
        setApiError(msg);
        toast({ title: "Sem resultado", description: msg, variant: "destructive" });
        return;
      }

      setResult({
        success: true,
        ...(data || {}),
        movimentos: timeline?.movimentos || data?.dataJudRaw?.movimentos || [],
        comunicacoes: timeline?.comunicacoes || [],
        fonteMovimentos: timeline?.fonte || "datajud",
        avisoFontes: timeline?.message,
        resumoTecnico: data?.resumoTecnico || timeline?.message || "Timeline carregada.",
        engineUsed: data?.engineUsed || "server",
      });
      toast({
        title: timeline?.fonte === "djen" ? "Via DJEN" : "Consulta ok",
        description: timeline?.message || "Dados carregados no servidor.",
      });
    } catch (e: any) {
      if (!isMounted.current) return;
      const msg = e?.message || "Erro na consulta";
      setApiError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setResult(null);
    setListaResultados([]);
    setApiError(null);

    try {
      if (searchMode === "cpf") {
        const digits = cpfQuery.replace(/\D/g, "");
        if (digits.length < 11) {
          toast({ title: "CPF/CNPJ inválido", variant: "destructive" });
          setLoading(false);
          return;
        }
        const res = await searchProcessesByCpfAction(digits, filtroBA);
        const items = Array.isArray(res?.items) ? res.items : [];
        setListaResultados(items);
        if (items.length === 0) {
          const msg =
            res?.error ||
            "Nenhum processo. DataJud muitas vezes não indexa CPF. Tente NOME ou CNJ.";
          setApiError(msg);
          toast({ title: "Nenhum processo", description: msg, variant: "destructive" });
        } else {
          toast({ title: `${items.length} processo(s)` });
        }
        setLoading(false);
        return;
      }

      if (searchMode === "nome") {
        if (nomeQuery.trim().length < 5) {
          toast({ title: "Nome curto", variant: "destructive" });
          setLoading(false);
          return;
        }
        // SERVER ONLY — nunca searchDataJudByNome no client
        const res = await searchProcessesByNomeAction(nomeQuery.trim());
        let items = Array.isArray(res?.items) ? res.items : [];
        if (filtroBA) {
          items = items.filter(
            (x) =>
              x.isBuscaApreensao ||
              /BUSCA\s*E?\s*APREENS/i.test(String(x.classe || ""))
          );
        }
        setListaResultados(items);
        if (items.length === 0) {
          const msg = res?.error || "Nenhum processo para este nome. Tente o CNJ.";
          setApiError(msg);
          toast({ title: "Nenhum processo", description: msg, variant: "destructive" });
        } else {
          toast({ title: `${items.length} processo(s)` });
        }
        setLoading(false);
        return;
      }

      // CNJ
      if (!cnj.trim()) {
        setLoading(false);
        return;
      }
      await runVereditoForCnj(cnj.trim());
    } catch (err: any) {
      setApiError(err?.message || "Erro na busca");
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Consulta de processo</h1>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              CNJ · CPF · Nome — DataJud e DJEN só no servidor (sem CORS)
            </p>
          </div>

          <DataJudDisclaimer />

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["cnj", "CNJ"],
                ["cpf", "CPF / CNPJ"],
                ["nome", "Nome"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={searchMode === k ? "default" : "outline"}
                onClick={() => {
                  setSearchMode(k);
                  setListaResultados([]);
                  setApiError(null);
                }}
                className="font-bold uppercase text-[10px]"
              >
                {label}
              </Button>
            ))}
            <label className="flex items-center gap-2 ml-2 text-[10px] font-bold uppercase cursor-pointer">
              <input
                type="checkbox"
                checked={filtroBA}
                onChange={(e) => setFiltroBA(e.target.checked)}
              />
              Só busca e apreensão
            </label>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            {searchMode === "cnj" && (
              <Input
                placeholder="CNJ (20 dígitos)"
                value={cnj}
                onChange={(e) => setCnj(e.target.value)}
                className="h-12 font-mono flex-1"
              />
            )}
            {searchMode === "cpf" && (
              <Input
                placeholder="CPF ou CNPJ"
                value={cpfQuery}
                onChange={(e) => setCpfQuery(e.target.value)}
                className="h-12 font-mono flex-1"
              />
            )}
            {searchMode === "nome" && (
              <Input
                placeholder="Nome completo da parte"
                value={nomeQuery}
                onChange={(e) => setNomeQuery(e.target.value)}
                className="h-12 flex-1"
              />
            )}
            <Button type="submit" disabled={loading} className="h-12 px-6 font-bold uppercase text-xs shrink-0">
              {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Search size={16} className="mr-2" />}
              Consultar
            </Button>
          </form>

          {apiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Aviso</AlertTitle>
              <AlertDescription className="text-sm">{apiError}</AlertDescription>
            </Alert>
          )}

          {listaResultados.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {listaResultados.length} processo(s) — clique para abrir
              </p>
              {listaResultados.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => runVereditoForCnj(String(item.numeroProcesso || ""))}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-all shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-sm font-bold">{item.numeroProcesso}</span>
                    {item.tribunal && (
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {item.tribunal}
                      </Badge>
                    )}
                    {(item.isBuscaApreensao ||
                      /BUSCA|APREENS/i.test(String(item.classe || ""))) && (
                      <Badge className="bg-red-600 text-white text-[9px] uppercase">
                        Busca e apreensão
                      </Badge>
                    )}
                    {item.origem && (
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {item.origem}
                      </Badge>
                    )}
                  </div>
                  {item.classe && (
                    <p className="text-xs text-muted-foreground mb-2">{item.classe}</p>
                  )}
                  <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="opacity-50 uppercase text-[9px] font-bold">Polo ativo</p>
                      <p className="font-medium">
                        {(item.poloAtivo && item.poloAtivo.length)
                          ? item.poloAtivo.join(", ")
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="opacity-50 uppercase text-[9px] font-bold">Polo passivo</p>
                      <p className="font-medium">
                        {(item.poloPassivo && item.poloPassivo.length)
                          ? item.poloPassivo.join(", ")
                          : "—"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle className="text-xs uppercase font-bold">Fonte</AlertTitle>
                <AlertDescription className="text-sm">
                  {result.avisoFontes ||
                    `Movimentos: ${result.fonteMovimentos || "servidor"}. Confira no PJe se for crítico.`}
                </AlertDescription>
              </Alert>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Parecer / resumo
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {result.resumoTecnico || "—"}
                </p>
              </div>
              {Array.isArray(result.movimentos) && result.movimentos.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                    Últimos movimentos ({result.movimentos.length})
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto text-xs">
                    {result.movimentos.slice(0, 30).map((m: any, i: number) => (
                      <li key={i} className="border-b border-border/50 pb-2">
                        <span className="font-semibold">{m.nome || m.fonte || "Mov."}</span>
                        {m.dataHora && (
                          <span className="opacity-50 ml-2 font-mono text-[10px]">
                            {String(m.dataHora).slice(0, 19)}
                          </span>
                        )}
                        {(m.complemento || m.descricao) && (
                          <p className="opacity-70 mt-0.5 line-clamp-2">
                            {m.complemento || m.descricao}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.analiseRisco && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Risco
                  </p>
                  <p className="text-sm">{result.analiseRisco}</p>
                </div>
              )}
              {result.mensagemCliente && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                    Sugestão ao cliente
                  </p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/40 p-3 rounded-lg">
                    {result.mensagemCliente}
                  </p>
                </div>
              )}
            </div>
          )}

          <footer className="text-[10px] text-muted-foreground flex items-center gap-2 justify-center py-6">
            <Copyright size={10} /> LexisPredict · consulta server-side
          </footer>
        </div>
      </main>
    </div>
  );
}
