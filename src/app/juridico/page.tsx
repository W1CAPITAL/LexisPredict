"use client";

/**
 * Aba Jurídico — petições, audiências, prazos processuais, andamentos e peças.
 * Registro manual por processo (CNJ) com linha do tempo e geração de petição.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Gavel,
  CalendarClock,
  FileText,
  Plus,
  Trash2,
  Scale,
  AlertCircle,
  CheckCircle2,
  Clock,
  Landmark,
  Eye,
  Users,
  Database,
  Download,
  UserRound,
} from "lucide-react";
import {
  listarClientesOperacaoAction,
  salvarClienteOperacaoAction,
  excluirClienteOperacaoAction,
} from "@/app/actions/clientes-operacao-actions";
import { gerarPecaTextoPDFAction } from "@/app/actions/document-actions";
import { downloadBase64File } from "@/lib/download-export";

type TipoAndamento = "peticao" | "audiencia" | "prazo" | "movimentacao" | "peca";

interface Andamento {
  id: string;
  tipo: TipoAndamento;
  titulo: string;
  descricao: string;
  data: string;
  status?: string;
}

const TIPO_LABEL: Record<TipoAndamento, string> = {
  peticao: "Petição",
  audiencia: "Audiência",
  prazo: "Prazo",
  movimentacao: "Andamento",
  peca: "Peça",
};

const TIPO_TONE: Record<TipoAndamento, string> = {
  peticao: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  audiencia: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  prazo: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  movimentacao: "bg-muted text-muted-foreground border-border",
  peca: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function diasUteisAte(dataISO: string): number | null {
  if (!dataISO) return null;
  const alvo = new Date(dataISO + "T12:00:00");
  const agora = new Date();
  const diff = Math.round((alvo.getTime() - agora.getTime()) / 86400000);
  return diff;
}

export default function JuridicoPage() {
  const { profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [cnj, setCnj] = useState("");
  const [cliente, setCliente] = useState("");
  const [banco, setBanco] = useState("");
  const [advogado, setAdvogado] = useState("");
  const [atendente, setAtendente] = useState("");
  const [andamentos, setAndamentos] = useState<Andamento[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novaData, setNovaData] = useState(hojeISO());
  const [novoTipo, setNovoTipo] = useState<TipoAndamento>("movimentacao");
  const [peticaoAberta, setPeticaoAberta] = useState<string | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !profile) return;
    try {
      setIsAdmin(!!(checkIfSuperAdmin(profile) || checkIfSupervisor(profile)));
    } catch {
      setIsAdmin(false);
    }
  }, [authLoading, profile]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setClientesLoading(true);
      const res = await listarClientesOperacaoAction('juridico');
      if (ativo && res?.success) setClientes(res.items || []);
      if (ativo) setClientesLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!cnj && !cliente) return;
    const dig = cnj.replace(/\D/g, "");
    const chave = `juridico:${dig || cliente.trim().toUpperCase() || "semncnj"}`;
    const saved = localStorage.getItem(chave);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCliente(data.cliente || "");
        setBanco(data.banco || "");
        setAdvogado(data.advogado || "");
        setAtendente(data.atendente || "");
        setAndamentos(data.andamentos || []);
      } catch {
        /* ignore */
      }
    } else {
      setCliente("");
      setBanco("");
      setAdvogado("");
      setAtendente("");
      setAndamentos([]);
    }
  }, [cnj, cliente]);

  const persistir = (a: Andamento[], c?: string, b?: string, adv?: string, atend?: string) => {
    const dig = (c ?? cnj).replace(/\D/g, "");
    const chave = `juridico:${dig || (c ?? cliente).trim().toUpperCase() || "semncnj"}`;
    if (!dig && !(c ?? cliente).trim()) return;
    localStorage.setItem(
      chave,
      JSON.stringify({
        cliente: c ?? cliente,
        banco: b ?? banco,
        advogado: adv ?? advogado,
        atendente: atend ?? atendente,
        andamentos: a,
      })
    );
  };

  const addAndamento = () => {
    if (!novoTitulo.trim()) {
      toast({ title: "Campos obrigatórios", description: "Informe o título do andamento.", variant: "destructive" });
      return;
    }
    if (!atendente.trim()) {
      toast({ title: "Responsável obrigatório", description: "Informe o usuário, atendente, vendedor ou assistente responsável.", variant: "destructive" });
      return;
    }
    const novo: Andamento = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: novoTipo,
      titulo: novoTitulo.trim(),
      descricao: novoDescricao.trim(),
      data: novaData,
      status: novoTipo === "prazo" ? "PENDENTE" : undefined,
    };
    const next = [...andamentos, novo];
    setAndamentos(next);
    persistir(next);
    setNovoTitulo("");
    setNovoDescricao("");
    toast({ title: "Registrado", description: `${TIPO_LABEL[novoTipo]} adicionado ao processo.` });
  };

  const removeAndamento = (id: string) => {
    const next = andamentos.filter((a) => a.id !== id);
    setAndamentos(next);
    persistir(next);
  };

  const salvarDados = async () => {
    if (!atendente.trim()) {
      toast({ title: "Responsável obrigatório", description: "Informe o usuário, atendente, vendedor ou assistente responsável.", variant: "destructive" });
      return;
    }
    persistir(andamentos);
    setSaving(true);
    const res = await salvarClienteOperacaoAction({
      tipo: 'juridico',
      cliente: cliente.trim() || cnj.trim() || atendente.trim(),
      banco,
      protocolo: cnj,
      dados: { banco, advogado, atendente, cliente, andamentos },
    });
    setSaving(false);
    if (res?.success) {
      const list = await listarClientesOperacaoAction('juridico');
      if (list?.success) setClientes(list.items || []);
      toast({ title: "Processo salvo", description: res.message || "Registrado no Supabase." });
    } else {
      toast({
        title: "Salvo apenas localmente",
        description: res?.error || "Não foi possível gravar no Supabase.",
        variant: "destructive",
      });
    }
  };

  const carregarCliente = (c: any) => {
    const dados = c?.dados || {};
    setCnj(c.protocolo || "");
    setCliente(c.cliente || dados.cliente || "");
    setBanco(c.banco || dados.banco || "");
    setAdvogado(dados.advogado || "");
    setAtendente(dados.atendente || "");
    setAndamentos(dados.andamentos || []);
    toast({ title: "Processo carregado", description: c.cliente || "Registro do Supabase." });
  };

  const excluirCliente = async (id: string) => {
    const res = await excluirClienteOperacaoAction(id);
    toast({
      title: res?.success ? "Excluído" : "Sem permissão",
      description: res?.message || res?.error,
      variant: res?.success ? "default" : "destructive",
    });
    if (res?.success) {
      const list = await listarClientesOperacaoAction('juridico');
      if (list?.success) setClientes(list.items || []);
    }
  };

  const ordenados = useMemo(
    () => [...andamentos].sort((a, b) => b.data.localeCompare(a.data)),
    [andamentos]
  );

  const prazosPendentes = ordenados.filter((a) => a.tipo === "prazo");

  const gerarPeticao = (and: Andamento) => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    const assinatura = advogado ? advogado.toUpperCase() : atendente ? atendente.toUpperCase() : "";
    const linhas = [
      "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO",
      "",
      cnj ? `Processo nº: ${cnj}` : "",
      `Cliente: ${cliente || "—"}`,
      `Banco / Réu: ${banco || "—"}`,
      advogado ? `Advogado(a): ${advogado}` : "",
      atendente ? `Responsável: ${atendente}` : "",
      "",
      "PETIÇÃO",
      "",
      `${novoDescricao ? novoDescricao.trim() + "\n\n" : ""}${and.titulo}.`,
      "",
      "Termos em que pede deferimento.",
      `${new Date().toLocaleDateString("pt-BR")}`,
      assinatura,
      advogado ? "OAB/SP" : "",
    ].filter((l) => l !== "");
    setPeticaoAberta(linhas.join("\n"));
  };

  const baixarPeticaoPDF = async () => {
    if (!peticaoAberta) return;
    setPdfLoading(true);
    try {
      const res = await gerarPecaTextoPDFAction({ texto: peticaoAberta, titulo: "Petição" });
      if (!res?.success) throw new Error(res?.error || "Falha ao gerar PDF.");
      downloadBase64File(res.base64, `peticao-${cnj.replace(/\D/g, "") || cliente || "sem-cnj"}.pdf`, "application/pdf");
      toast({ title: "PDF gerado", description: "Petição baixada em PDF." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao gerar PDF.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Acesso restrito a Supervisor / Administrador / Superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Aba Jurídico</h1>
                <p className="text-xs text-muted-foreground">
                  Petições, audiências, prazos processuais, andamentos e peças por processo.
                </p>
              </div>
              <Button size="sm" onClick={salvarDados} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Salvar processo
              </Button>
            </div>

            {/* Clientes salvos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Clientes salvos
                  {clientesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Badge variant="outline" className="ml-auto">{clientes.length}</Badge>}
                </CardTitle>
                <CardDescription>Processos jurídicos persistidos no Supabase.</CardDescription>
              </CardHeader>
              <CardContent>
                {clientes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum processo salvo ainda. Preencha o CNJ e clique em "Salvar processo".</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {clientes.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border/70 p-3">
                        <button type="button" className="w-full text-left" onClick={() => carregarCliente(c)}>
                          <p className="text-sm font-bold truncate">{c.cliente}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.protocolo || "sem CNJ"}</p>
                          <p className="text-[10px] text-muted-foreground/60">
                            {c.banco || "—"} • {c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : ""}
                          </p>
                        </button>
                        <div className="mt-1 flex items-center justify-between">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => carregarCliente(c)}>Abrir</Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => excluirCliente(c.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dados do processo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" /> Dados do processo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CNJ (opcional)</Label>
                    <Input value={cnj} onChange={(e) => setCnj(e.target.value)} placeholder="0000000-00.2026.8.26.0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</Label>
                    <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Banco / Réu</Label>
                    <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Parte passiva" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Advogado (opcional)</Label>
                    <Input value={advogado} onChange={(e) => setAdvogado(e.target.value)} placeholder="Advogado do polo ativo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Responsável <span className="text-destructive">*</span>
                    </Label>
                    <Input value={atendente} onChange={(e) => setAtendente(e.target.value)} placeholder="Usuário, atendente, vendedor ou assistente" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Registrar andamento */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" /> Registrar
                  </CardTitle>
                  <CardDescription>Petição, audiência, prazo, andamento ou peça.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(TIPO_LABEL) as TipoAndamento[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNovoTipo(t)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all",
                            novoTipo === t
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {TIPO_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Título</Label>
                    <Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Ex: Audiência de conciliação" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</Label>
                    <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Descrição / Observações</Label>
                    <Textarea value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} rows={4} placeholder="Detalhes do andamento..." />
                  </div>
                  <Button className="w-full" onClick={addAndamento}>
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                  </Button>
                </CardContent>
              </Card>

              {/* Linha do tempo */}
              <div className="lg:col-span-2 space-y-6">
                {prazosPendentes.length > 0 ? (
                  <Card className="border-red-500/30">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" /> Prazos pendentes ({prazosPendentes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {prazosPendentes.map((p) => {
                        const d = diasUteisAte(p.data);
                        const vencido = d !== null && d < 0;
                        const urgente = d !== null && d >= 0 && d <= 2;
                        return (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
                            <div>
                              <p className="text-sm font-bold">{p.titulo}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{p.data}</p>
                            </div>
                            <Badge className={cn(vencido ? "bg-red-600" : urgente ? "bg-amber-500 text-black" : "bg-muted text-muted-foreground")}>
                              {vencido ? `Vencido há ${Math.abs(d!)}d` : d === 0 ? "Hoje" : urgente ? `${d}d` : `${d} dias`}
                            </Badge>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Linha do tempo ({ordenados.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ordenados.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">
                        Nenhum registro ainda. Informe os dados do processo e adicione o primeiro andamento.
                      </p>
                    ) : (
                      <ScrollArea className="h-[420px] pr-2">
                        <div className="space-y-2">
                          {ordenados.map((a) => (
                            <div key={a.id} className="rounded-xl border border-border/70 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className={cn("text-[9px]", TIPO_TONE[a.tipo])}>
                                      {TIPO_LABEL[a.tipo]}
                                    </Badge>
                                    <p className="text-sm font-bold truncate">{a.titulo}</p>
                                  </div>
                                  {a.descricao ? <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{a.descricao}</p> : null}
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{a.data}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Gerar petição" onClick={() => gerarPeticao(a)}>
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Remover" onClick={() => removeAndamento(a.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Petição gerada */}
            {peticaoAberta ? (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" /> Petição gerada
                    <Badge variant="outline" className="ml-auto">Modelo</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-4 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {peticaoAberta}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" onClick={baixarPeticaoPDF} disabled={pdfLoading}>
                      {pdfLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Baixar PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPeticaoAberta(null)}>
                      <Eye className="mr-1.5 h-4 w-4" /> Fechar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
