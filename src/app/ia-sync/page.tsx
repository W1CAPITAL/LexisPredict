"use client";

/**
 * Cadastro (unificado) — antes "Sincronia IA · DataJud · DJEN".
 * Consulta um CNJ nas fontes oficiais (DataJud + DJEN) com enriquecimento
 * exclusivo DJEN (rápido), permite edição manual completa do cadastro e
 * gera peça/minuta em PDF.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { listAssignableUsersAction, type AssignableUser } from "@/app/actions/team-list-actions";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
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
  Save,
  Search,
  Download,
  UserRound,
} from "lucide-react";
import {
  sincronizarCasoIACompletoAction,
  gerarPecaIAction,
} from "@/app/actions/ia-sync-actions";
import {
  enrichCadastroByCnjAction,
  registerCaseFromAutomacaoAction,
} from "@/app/actions/automacao-register-actions";
import { gerarPecaTextoPDFAction } from "@/app/actions/document-actions";
import { downloadBase64File } from "@/lib/download-export";

type TipoPeca = "informacoes" | "juntada" | "urgente" | "atualizacao";

const PECA_OPTIONS: { value: TipoPeca; label: string }[] = [
  { value: "informacoes", label: "Pedido de informações / certidão" },
  { value: "juntada", label: "Juntada de procuração" },
  { value: "urgente", label: "Tutela de urgência" },
  { value: "atualizacao", label: "Atualização cadastral" },
];

const FORM_FIELDS: { key: string; label: string; placeholder?: string; sm?: boolean }[] = [
  { key: "cliente", label: "Cliente *", placeholder: "Nome do autor", sm: true },
  { key: "parte_passiva", label: "Parte passiva / réu", placeholder: "Banco ou réu", sm: true },
  { key: "parte_passiva_cnpj", label: "CNPJ réu", placeholder: "00.000.000/0000-00", sm: true },
  { key: "advogado", label: "Advogado (ativo)", placeholder: "Dr(a) do cliente", sm: true },
  { key: "advogado_passivo", label: "Advogado (passivo)", placeholder: "Dr(a) do réu", sm: true },
  { key: "escritorio", label: "Escritório", placeholder: "Nome do escritório", sm: true },
  { key: "classe_acao", label: "Classe / ação", placeholder: "Procedimento comum cível", sm: true },
  { key: "tribunal", label: "Tribunal", placeholder: "TJSP", sm: true },
  { key: "orgao_julgador", label: "Órgão julgador", placeholder: "1ª Vara Cível", sm: true },
  { key: "cpf", label: "CPF", placeholder: "000.000.000-00", sm: true },
  { key: "email", label: "E-mail", placeholder: "cliente@email.com", sm: true },
  { key: "telefone", label: "Telefone", placeholder: "(11) 99999-9999", sm: true },
  { key: "estado_civil", label: "Estado civil", placeholder: "Solteiro(a)", sm: true },
  { key: "emprego", label: "Emprego", placeholder: "Profissão / vínculo", sm: true },
  { key: "nacionalidade", label: "Nacionalidade", placeholder: "Brasileira", sm: true },
  { key: "classificacao", label: "Classificação", placeholder: "Crédito consignado", sm: true },
  { key: "ofensor", label: "Ofensor", placeholder: "Origem do problema", sm: true },
  { key: "proximoPrazo", label: "Próximo prazo", placeholder: "AAAA-MM-DD", sm: true },
  { key: "situacao", label: "Situação", placeholder: "EM ANDAMENTO", sm: true },
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

  const [form, setForm] = useState<Record<string, string>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [ownerAuthId, setOwnerAuthId] = useState<string>("self");

  const canAssignOwner =
    checkIfSuperAdmin(profile) ||
    checkIfSupervisor(profile) ||
    profile?.cargo === "Administrador" ||
    profile?.cargo === "Supervisor" ||
    profile?.cargo === "Superadmin";

  useEffect(() => {
    if (!canAssignOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listAssignableUsersAction();
        if (!cancelled) setAssignableUsers(list || []);
      } catch {
        if (!cancelled) setAssignableUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignOwner]);

  const [tipoPeca, setTipoPeca] = useState<TipoPeca>("informacoes");
  const [peca, setPeca] = useState("");
  const [pecaLoading, setPecaLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const applyMeta = (m: any) => {
    setForm((f) => ({
      ...f,
      cliente: m?.cliente || f.cliente || "",
      parte_passiva: m?.parte_passiva || f.parte_passiva || "",
      parte_passiva_cnpj: m?.parte_passiva_cnpj || f.parte_passiva_cnpj || "",
      advogado: m?.advogado || f.advogado || "",
      classe_acao: m?.classe_acao || f.classe_acao || "",
      tribunal: m?.tribunal || f.tribunal || "",
      orgao_julgador: m?.orgao_julgador || f.orgao_julgador || "",
      cpf: m?.cpf || f.cpf || "",
      email: m?.email || f.email || "",
      telefone: m?.telefone || f.telefone || "",
    }));
  };

  useEffect(() => {
    if (result?.meta) applyMeta(result.meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const buscarDjen = async () => {
    setFormLoading(true);
    try {
      const res = await enrichCadastroByCnjAction(cnj);
      if (!res?.success) {
        toast({ title: "Sem dados", description: res?.error, variant: "destructive" });
        return;
      }
      setForm((f) => ({
        ...f,
        cliente: res.cliente || f.cliente || "",
        parte_passiva: res.parte_passiva || f.parte_passiva || "",
        parte_passiva_cnpj: res.parte_passiva_cnpj || f.parte_passiva_cnpj || "",
        advogado: res.advogado || f.advogado || "",
        advogado_passivo: res.advogado_passivo || f.advogado_passivo || "",
        classe_acao: res.classe_acao || f.classe_acao || "",
        tribunal: res.tribunal || f.tribunal || "",
        orgao_julgador: res.orgao_julgador || f.orgao_julgador || "",
        cpf: res.cpf || f.cpf || "",
        email: res.email || f.email || "",
        telefone: res.telefone || f.telefone || "",
      }));
      toast({ title: "Enriquecido", description: `Fonte: ${res.fonte || "DJEN"}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const salvarManual = async () => {
    if (!form.cliente?.trim()) {
      toast({ title: "Cliente obrigatório", description: "Informe o nome do cliente para salvar na carteira.", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const res = await registerCaseFromAutomacaoAction({
        protocolo: cnj,
        ...form,
        ...(canAssignOwner && ownerAuthId && ownerAuthId !== "self"
          ? { created_by: ownerAuthId }
          : {}),
      } as any);
      if (!res?.success) throw new Error(res?.error || "Falha ao salvar.");
      toast({ title: "Salvo", description: res.message });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const genPeca = async () => {
    if (!result?.protocolo) return;
    setPecaLoading(true);
    try {
      const res = await gerarPecaIAction({
        cnj: result.protocolo,
        cliente: form.cliente || result.meta?.cliente || cliente,
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

  const baixarPecaPDF = async () => {
    if (!peca) return;
    setPdfLoading(true);
    try {
      const res = await gerarPecaTextoPDFAction({
        texto: peca,
        titulo: PECA_OPTIONS.find((p) => p.value === tipoPeca)?.label || "Peça",
      });
      if (!res?.success) throw new Error(res?.error || "Falha ao gerar PDF.");
      downloadBase64File(
        res.base64,
        `peca-${cnj.replace(/\D/g, "") || "sem-cnj"}-${tipoPeca}.pdf`,
        "application/pdf"
      );
      toast({ title: "PDF gerado", description: "Peça baixada em PDF." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
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
                <h1 className="text-2xl font-black tracking-tight">Cadastro</h1>
                <p className="text-xs text-muted-foreground">
                  Consulta oficial no CNJ e no diário, cadastro manual completo, carteira e peças em PDF.
                </p>
              </div>
              {result?.engineUsed && (
                <Badge variant="outline" className="gap-1 text-[9px] uppercase">
                  <Zap className="h-3 w-3 text-primary" /> Motor: {result.engineUsed}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sincronizar por CNJ */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-primary" /> Sincronizar por CNJ
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Consulta oficial no DataJud + DJEN, extrai partes, prazos e eventos e salva na carteira.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
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
                  <Button className="w-full h-10" onClick={sync} disabled={loading}>
                    {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                    Sincronizar
                  </Button>
                  <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={salvarCarteira} onChange={(e) => setSalvarCarteira(e.target.checked)} />
                    Salvar na carteira (Processos) após sincronizar
                  </label>
                </CardContent>
              </Card>

              {/* Cadastro manual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" /> Cadastro manual
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Complete os dados do processo manualmente ou clique em &quot;Buscar no DJEN&quot; para um preenchimento rápido.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FORM_FIELDS.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{f.label}</Label>
                        <Input
                          value={form[f.key] || ""}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="h-9 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <Textarea
                    value={form.observacao || ""}
                    onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
                    rows={3}
                    placeholder="Observações / histórico (opcional)"
                    className="text-xs"
                  />
                  {canAssignOwner && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Responsável pelo contrato (carteira do operador)
                      </Label>
                      <Select value={ownerAuthId} onValueChange={setOwnerAuthId}>
                        <SelectTrigger className="h-10 text-xs font-semibold">
                          <SelectValue placeholder="Quem fica com este processo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Eu (quem está logado)</SelectItem>
                          {assignableUsers.map((u) => (
                            <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                              {u.nome}{u.cargo ? ` · ${u.cargo}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        O processo entra na carteira do usuário escolhido. Operadores só veem os próprios.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={buscarDjen} disabled={formLoading}>
                      {formLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
                      Buscar no DJEN
                    </Button>
                    <Button onClick={salvarManual} disabled={salvando}>
                      {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                      Salvar na carteira
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Minuta</p>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={copy}>
                                <Copy className="mr-1 h-3 w-3" /> Copiar
                              </Button>
                              <Button size="sm" className="h-7 text-[10px]" onClick={baixarPecaPDF} disabled={pdfLoading}>
                                {pdfLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />} PDF
                              </Button>
                            </div>
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
