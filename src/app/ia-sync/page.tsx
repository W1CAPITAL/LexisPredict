"use client";

/**
 * Sincronia IA + DataJud + DJEN (E1).
 * Consulta um CNJ nas duas fontes oficiais, extrai polos/prazos/eventos,
 * roda a camada de IA com fallback determinístico e gera minuta de peça.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  Zap,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Gavel,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import {
  sincronizarCasoIACompletoAction,
  gerarPecaIAction,
} from "@/app/actions/ia-sync-actions";

type TipoPeca = "informacoes" | "juntada" | "urgente" | "atualizacao";

const PECA_OPTIONS: { value: TipoPeca; label: string }[] = [
  { value: "informacoes", label: "Pedido de informações / certidão" },
  { value: "juntada", label: "Juntada de procuração" },
  { value: "urgente", label: "Tutela de urgência" },
  { value: "atualizacao", label: "Atualização cadastral" },
];

export default function IASyncPage() {
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [cnj, setCnj] = useState("");
  const [cliente, setCliente] = useState("");
  const [salvarCarteira, setSalvarCarteira] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("informacoes");
  const [peca, setPeca] = useState("");
  const [pecaLoading, setPecaLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ia_sync_last_cnj");
    if (saved) setCnj(saved);
  }, []);

  const sync = async () => {
    setLoading(true);
    setApiError(null);
    setResult(null);
    setPeca("");
    try {
      const res = await sincronizarCasoIACompletoAction({
        cnj,
        cliente: cliente || undefined,
        salvarCarteira,
      });
      if (!res?.success) {
        setApiError(res?.error || "Falha na sincronização.");
        toast({ title: "Sem resultado", description: res?.error, variant: "destructive" });
        return;
      }
      localStorage.setItem("ia_sync_last_cnj", res.protocolo || cnj);
      setResult(res);
      if (res.salvo) {
        toast({ title: "Carteira atualizada", description: res.mensagemSalvar });
      } else {
        toast({ title: "Sincronizado", description: `Motor: ${res.engineUsed}` });
      }
    } catch (e: any) {
      setApiError(e?.message || "Erro na sincronização.");
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const genPeca = async () => {
    if (!result?.protocolo) return;
    setPecaLoading(true);
    try {
      const res = await gerarPecaIAction({
        cnj: result.protocolo,
        cliente: result.meta?.cliente || cliente,
        tipoPeca,
      });
      if (!res?.success) {
        toast({ title: "Erro", description: res?.error, variant: "destructive" });
        return;
      }
      setPeca(res.peca);
      toast({ title: "Peça gerada", description: res.tipoLabel });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setPecaLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(peca);
      toast({ title: "Copiado", description: "Minuta copiada para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
      </div>
    );
  }

  const m = result?.meta;
  const evento = result?.evento;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Sincronia IA · DataJud · DJEN</h1>
                <p className="text-xs text-muted-foreground">
                  Consulta oficial no CNJ e no diário, extrai partes, prazos e eventos, e gera peça pronta.
                </p>
              </div>
              {result?.engineUsed && (
                <Badge variant="outline" className="gap-1 text-[9px] uppercase">
                  <Zap className="h-3 w-3 text-primary" /> Motor: {result.engineUsed}
                </Badge>
              )}
            </div>

            <Card>
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CNJ (20 dígitos)</Label>
                    <Input
                      value={cnj}
                      onChange={(e) => setCnj(e.target.value)}
                      placeholder="0000000-00.2026.8.26.0000"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente (dica opcional)</Label>
                    <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do autor" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button className="flex-1 h-10" onClick={sync} disabled={loading}>
                      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                      Sincronizar
                    </Button>
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={salvarCarteira} onChange={(e) => setSalvarCarteira(e.target.checked)} />
                  Salvar na carteira (Processos) após sincronizar
                </label>
              </CardContent>
            </Card>

            {apiError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Aviso</AlertTitle>
                <AlertDescription className="text-sm">{apiError}</AlertDescription>
              </Alert>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!loading && result && (
              <div className="space-y-6">
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Gavel className="h-4 w-4 text-primary" /> Dados extraídos
                      {result.salvo && (
                        <Badge className="bg-emerald-600 text-white text-[9px] uppercase gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Salvo na carteira
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Fonte: {result.fonte || "DataJud+DJEN"} · {result.movimentos?.length || 0} movimentos · {result.comunicacoes?.length || 0} publicações
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                      {[
                        ["Cliente", m?.cliente],
                        ["Parte passiva", m?.parte_passiva],
                        ["CNPJ réu", m?.parte_passiva_cnpj],
                        ["Advogado", m?.advogado],
                        ["Classe", m?.classe_acao],
                        ["Tribunal", m?.tribunal],
                        ["Órgão", m?.orgao_julgador],
                        ["CPF", m?.cpf],
                        ["E-mail", m?.email],
                        ["Telefone", m?.telefone],
                        ["Distribuição", m?.dataDistribuicao],
                        ["Risco", m?.risco],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border/60 p-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
                          <p className="mt-0.5 font-semibold truncate">{value || "—"}</p>
                        </div>
                      ))}
                    </div>

                    {result.prazoDetectado ? (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs">
                        <CalendarClock className="h-4 w-4 text-red-500" />
                        <b>Próximo prazo/audiência detectado: {String(result.prazoDetectado).slice(0, 10)}</b>
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {evento?.evento_resumo ? (
                        <div className="rounded-lg bg-muted/40 p-2 text-xs">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                            Evento mais recente · {evento.evento_fonte} · {evento.evento_data || "S/D"}
                          </p>
                          <p className="font-semibold">{evento.evento_resumo}</p>
                        </div>
                      ) : null}
                      {m?.resumo ? (
                        <div className="rounded-lg bg-muted/40 p-2 text-xs">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Resumo IA</p>
                          <p className="font-medium">{m.resumo}</p>
                        </div>
                      ) : null}
                      {m?.sugestao ? (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2 text-xs">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Sugestão</p>
                          <p>{m.sugestao}</p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Gerar peça
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {PECA_OPTIONS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setTipoPeca(p.value)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all",
                              tipoPeca === p.value
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <Button size="sm" onClick={genPeca} disabled={pecaLoading}>
                        {pecaLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                        Gerar minuta
                      </Button>
                      {peca ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Minuta (copiar para o Word)</p>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={copy}>
                              <Copy className="mr-1 h-3 w-3" /> Copiar
                            </Button>
                          </div>
                          <Textarea readOnly value={peca} rows={16} className="font-serif text-xs leading-relaxed whitespace-pre-wrap" />
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Linha do tempo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[420px] pr-2">
                        <div className="space-y-2 text-xs">
                          {result.movimentos?.length || result.comunicacoes?.length ? (
                            <>
                              {[...(result.movimentos || []), ...(result.comunicacoes || [])]
                                .sort((a: any, b: any) => {
                                  const da = new Date(a.dataHora || a.data_disponibilizacao || 0).getTime();
                                  const db = new Date(b.dataHora || b.data_disponibilizacao || 0).getTime();
                                  return db - da;
                                })
                                .slice(0, 40)
                                .map((it: any, i: number) => {
                                  const data = String(it.dataHora || it.data_disponibilizacao || "").slice(0, 10);
                                  const fonte = it.fonte || (it.data_disponibilizacao ? "djen" : "datajud");
                                  const texto = it.complemento || it.descricao || it.textoPlain || "";
                                  return (
                                    <div key={i} className="rounded-lg border border-border/60 p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest">
                                          {fonte === "djen" ? "DJEN" : "DataJud"} · {data || "S/D"}
                                        </span>
                                        <Badge variant="outline" className="text-[8px]">
                                          {it.nome || it.tipoComunicacao || "Movimento"}
                                        </Badge>
                                      </div>
                                      {texto ? <p className="mt-1 line-clamp-3 text-muted-foreground">{String(texto)}</p> : null}
                                    </div>
                                  );
                                })}
                            </>
                          ) : (
                            <p className="text-center py-8 text-muted-foreground">Sem movimentos nem publicações.</p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
