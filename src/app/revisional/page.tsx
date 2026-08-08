"use client";

/**
 * Revisional Admin — análise de revisão de contrato bancário.
 * Múltiplas simulações por cliente (Supabase), comparativo Price × SAC,
 * referência BACEN, minuta de petição revisional com impressão/PDF e export CSV.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { checkIfSuperAdmin, checkIfSupervisor } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Percent,
  Landmark,
  Receipt,
  TrendingDown,
  PiggyBank,
  Calculator,
  FileDown,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Database,
  Trash2,
  FileText,
  Printer,
  Copy,
  Banknote,
  Layers,
} from "lucide-react";
import {
  listarClientesOperacaoAction,
  salvarClienteOperacaoAction,
  excluirClienteOperacaoAction,
} from "@/app/actions/clientes-operacao-actions";
import { TAXAS_BACEN, taxaSugeridaPorModalidade } from "@/lib/taxas-bacen";

type Plano = "price" | "sac";

interface RevisionalInput {
  banco: string;
  contrato: string;
  cliente: string;
  valor: string;
  parcelas: string;
  jurosAnual: string;
  jurosRevisado: string;
  cetAnual: string;
  dataInicio: string;
  plano: Plano;
}

const emptyInput = (): RevisionalInput => ({
  banco: "",
  contrato: "",
  cliente: "",
  valor: "",
  parcelas: "60",
  jurosAnual: "24",
  jurosRevisado: "12",
  cetAnual: "",
  dataInicio: new Date().toISOString().slice(0, 10),
  plano: "price",
});

function parseNum(v: string): number {
  const n = Number(String(v || '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface LinhaPlanilha {
  n: number;
  parcela: number;
  juros: number;
  amortizacao: number;
  saldo: number;
}

interface PlanilhaResultado {
  linhas: LinhaPlanilha[];
  valorFinanciado: number;
  jurosMensal: number;
  jurosRevisadoMensal: number;
  parcelaContratual: number;
  parcelaRevisada: number;
  totalContratual: number;
  totalRevisado: number;
  economia: number;
  economiaPct: number;
  primeiraParcela: string;
  ultimaParcela: string;
}

function calcularPlanilha(input: RevisionalInput, modo: Plano): PlanilhaResultado {
  const valor = parseNum(input.valor);
  const n = Math.max(1, Math.floor(parseNum(input.parcelas)));
  const jurosAnual = parseNum(input.jurosAnual) / 100;
  const jurosRev = parseNum(input.jurosRevisado) / 100;
  const iContratual = Math.pow(1 + jurosAnual, 1 / 12) - 1;
  const iRevisado = Math.pow(1 + jurosRev, 1 / 12) - 1;

  const amort = valor / n;
  const parcelaContratual = modo === "sac"
    ? amort + valor * iContratual
    : valor > 0 && iContratual > 0
      ? (valor * iContratual) / (1 - Math.pow(1 + iContratual, -n))
      : n > 0 ? valor / n : 0;
  const parcelaRevisada = modo === "sac"
    ? amort + valor * iRevisado
    : valor > 0 && iRevisado > 0
      ? (valor * iRevisado) / (1 - Math.pow(1 + iRevisado, -n))
      : n > 0 ? valor / n : 0;

  let saldo = valor;
  const linhas: LinhaPlanilha[] = [];
  let totalContratual = 0;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * iContratual;
    const amortizacao = modo === "sac" ? amort : parcelaContratual - juros;
    const parcela = modo === "sac" ? amortizacao + juros : parcelaContratual;
    saldo = Math.max(0, saldo - amortizacao);
    totalContratual += parcela;
    linhas.push({ n: k, parcela, juros, amortizacao, saldo });
  }
  const totalRevisado = modo === "sac"
    ? linhas.reduce((acc, l) => acc + (l.parcela - l.juros + l.saldo * iRevisado), 0)
    : parcelaRevisada * n;

  const economia = Math.max(0, totalContratual - totalRevisado);
  const economiaPct = totalContratual > 0 ? (economia / totalContratual) * 100 : 0;

  const inicio = input.dataInicio ? new Date(input.dataInicio + 'T12:00:00') : new Date();
  const addMes = (d: Date, m: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + m);
    return x.toLocaleDateString("pt-BR");
  };

  return {
    linhas,
    valorFinanciado: valor,
    jurosMensal: iContratual * 100,
    jurosRevisadoMensal: iRevisado * 100,
    parcelaContratual,
    parcelaRevisada,
    totalContratual,
    totalRevisado,
    economia,
    economiaPct,
    primeiraParcela: addMes(inicio, 1),
    ultimaParcela: addMes(inicio, n),
  };
}

interface Simulacao {
  id: string;
  nome: string;
  input: RevisionalInput;
  resumo?: { economia: number; parcelaContratual: number; parcelaRevisada: number };
}

function KpiCard({ icon, label, value, hint, tone = "default" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "danger" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    ok: "text-emerald-600 dark:text-emerald-400",
    danger: "text-red-600 dark:text-red-400",
    primary: "text-primary",
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-all">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <p className={cn("mt-3 text-2xl sm:text-3xl font-black tabular-nums tracking-tight", tones[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60">{hint}</p> : null}
    </div>
  );
}

export default function RevisionalPage() {
  const { profile, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [input, setInput] = useState<RevisionalInput>(emptyInput());
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [simulacaoAtivaId, setSimulacaoAtivaId] = useState<string | null>(null);
  const [nomeSimulacao, setNomeSimulacao] = useState("");
  const [minuta, setMinuta] = useState<string | null>(null);
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
      const res = await listarClientesOperacaoAction('revisional');
      if (ativo && res?.success) setClientes(res.items || []);
      if (ativo) setClientesLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const resultado = useMemo(() => calcularPlanilha(input, input.plano), [input]);
  const resultadoSac = useMemo(() => calcularPlanilha(input, "sac"), [input]);
  const { linhas, economia, economiaPct } = resultado;

  const setField = (k: keyof RevisionalInput, v: string) => {
    setInput((prev) => ({ ...prev, [k]: v }));
    if (k !== "plano" && simulacaoAtivaId) {
      setSimulacoes((prev) =>
        prev.map((s) => (s.id === simulacaoAtivaId ? { ...s, input: { ...s.input, [k]: v } } : s))
      );
    }
  };

  const salvar = async () => {
    setSaving(true);
    const agora = new Date().toISOString();
    const id = simulacaoAtivaId || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const novaSimulacao: Simulacao = {
      id,
      nome: (nomeSimulacao || `Simulação ${simulacoes.length + 1}`).slice(0, 120),
      input,
      resumo: { economia, parcelaContratual: resultado.parcelaContratual, parcelaRevisada: resultado.parcelaRevisada },
    };
    const novas = [...simulacoes.filter((s) => s.id !== id), novaSimulacao];
    setSimulacoes(novas);
    setSimulacaoAtivaId(id);

    const res = await salvarClienteOperacaoAction({
      tipo: 'revisional',
      cliente: input.cliente || input.contrato || 'Cliente sem nome',
      banco: input.banco,
      protocolo: input.contrato,
      dados: {
        simulacoes: novas,
        atualizadoEm: agora,
      },
    });
    setSaving(false);
    if (res?.success) {
      const list = await listarClientesOperacaoAction('revisional');
      if (list?.success) setClientes(list.items || []);
      toast({ title: "Simulação salva", description: res.message || "Registrada no Supabase." });
    } else {
      toast({
        title: "Salva apenas localmente",
        description: res?.error || "Não foi possível gravar no Supabase.",
        variant: "destructive",
      });
    }
  };

  const carregarCliente = (c: any) => {
    const dados = c?.dados || {};
    const sims: Simulacao[] = Array.isArray(dados.simulacoes) && dados.simulacoes.length
      ? dados.simulacoes
      : dados.input
        ? [{ id: c.id, nome: "Simulação", input: dados.input }]
        : [];
    if (!sims.length) {
      toast({ title: "Registro sem simulação", description: "Este cliente não possui dados de cálculo salvos.", variant: "destructive" });
      return;
    }
    setSimulacoes(sims);
    const ativa = sims[sims.length - 1];
    setSimulacaoAtivaId(ativa.id);
    setInput({ ...emptyInput(), ...ativa.input });
    setNomeSimulacao(ativa.nome);
    toast({ title: "Cliente carregado", description: c.cliente });
  };

  const excluirCliente = async (id: string) => {
    const res = await excluirClienteOperacaoAction(id);
    toast({
      title: res?.success ? "Excluído" : "Sem permissão",
      description: res?.message || res?.error,
      variant: res?.success ? "default" : "destructive",
    });
    if (res?.success) {
      const list = await listarClientesOperacaoAction('revisional');
      if (list?.success) setClientes(list.items || []);
    }
  };

  const selecionarSimulacao = (s: Simulacao) => {
    setSimulacaoAtivaId(s.id);
    setInput({ ...emptyInput(), ...s.input });
    setNomeSimulacao(s.nome);
  };

  const excluirSimulacao = (id: string) => {
    const novas = simulacoes.filter((s) => s.id !== id);
    setSimulacoes(novas);
    if (simulacaoAtivaId === id) {
      const prox = novas[novas.length - 1];
      if (prox) {
        setSimulacaoAtivaId(prox.id);
        setInput({ ...emptyInput(), ...prox.input });
        setNomeSimulacao(prox.nome);
      } else {
        setSimulacaoAtivaId(null);
        setInput(emptyInput());
        setNomeSimulacao("");
      }
    }
  };

  const exportCsv = () => {
    const head = "Parcela;Valor Parcela;Juros;Amortizacao;Saldo Devedor";
    const body = linhas
      .map((l) => `${l.n};${l.parcela.toFixed(2)};${l.juros.toFixed(2)};${l.amortizacao.toFixed(2)};${l.saldo.toFixed(2)}`)
      .join("\n");
    const csv = "\uFEFF" + [head, body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Revisional_${(input.contrato || 'contrato').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gerarMinuta = () => {
    const linhasMinuta = [
      "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA CÍVEL",
      "",
      `Processo/Contrato nº: ${input.contrato || "___"}`,
      `Cliente: ${input.cliente || "___"}`,
      `Banco Réu: ${input.banco || "___"}`,
      "",
      "PEDIDO DE REVISÃO CONTRATUAL — JUROS ABUSIVOS E ANATOCISMO",
      "",
      `${input.cliente || "O(a) requerente"}, já qualificado(a) nos autos, por seu advogado que esta subscreve, vem respeitosamente à presença de Vossa Excelência expor e requerer o seguinte:`,
      "",
      `1. O contrato foi firmado com taxa de juros contratual de ${parseNum(input.jurosAnual).toFixed(2)}% a.a., evidentemente superior à taxa média de mercado divulgada pelo Banco Central (referência BACEN).`,
      "",
      `2. A cobrança por meio de ${input.plano === "sac" ? "SAC" : "Tabela Price"} gera capitalização composta de juros (anatocismo), vedada pelo art. 4º do Decreto nº 22.626/33 e pela Súmula 121 do STF.`,
      "",
      `3. Aplicando-se a taxa revisada de ${parseNum(input.jurosRevisado).toFixed(2)}% a.a., a parcela cai de ${fmtBRL(resultado.parcelaContratual)} para ${fmtBRL(resultado.parcelaRevisada)} — economia total de ${fmtBRL(economia)} (${economiaPct.toFixed(1)}% do valor financiado).`,
      "",
      `4. O financiamento de ${fmtBRL(resultado.valorFinanciado)} em ${input.parcelas} parcelas, com 1ª parcela em ${resultado.primeiraParcela} e última em ${resultado.ultimaParcela}, deve ser recalculado sob os parâmetros legais.`,
      "",
      "Ante o exposto, requer a revisão do contrato para aplicação de juros compatíveis com a taxa média de mercado, com a consequente restituição do indébito, na forma do art. 478 e seguintes do Código Civil.",
      "",
      "Termos em que pede deferimento.",
      `${new Date().toLocaleDateString("pt-BR")}`,
      `${(input.banco ? "" : "")}Advogado(a): ${"___"}`,
      "OAB/___",
    ];
    setMinuta(linhasMinuta.join("\n"));
  };

  const imprimirMinuta = (texto: string) => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Minuta — Petição Revisional</title>` +
      `<style>body{font-family:'Times New Roman',serif;font-size:13px;line-height:1.7;margin:0;padding:40px}@media print{@page{margin:20mm}}</style></head><body>` +
      texto
        .split("\n")
        .map((l) => (l.trim() ? `<p style="margin:0 0 10px 0">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : `<p style="margin:0">&nbsp;</p>`))
        .join("") +
      `</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const copiarMinuta = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: "Copiado", description: "Minuta copiada para a área de transferência." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
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
        <p className="text-sm text-muted-foreground">Acesso restrito a Supervisor / Administrador / Superadmin.</p>
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
                <h1 className="text-2xl font-black tracking-tight">Revisional Admin</h1>
                <p className="text-xs text-muted-foreground">
                  Análise de revisão de contrato bancário — planilha de evolução, Price × SAC, BACEN e minuta.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!linhas.length}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={gerarMinuta} disabled={!input.valor}>
                  <FileText className="mr-1.5 h-4 w-4" /> Minuta da petição
                </Button>
                <Button size="sm" onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Salvar simulação
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulário */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" /> Análises salvas
                      {clientesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Badge variant="outline" className="ml-auto">{clientes.length}</Badge>}
                    </CardTitle>
                    <CardDescription>Clientes com simulações persistidas no Supabase.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {clientes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma análise salva ainda. Use "Salvar simulação" para registrar.</p>
                    ) : (
                      clientes.map((c) => (
                        <div key={c.id} className="rounded-xl border border-border/70 p-2.5">
                          <button type="button" className="w-full text-left" onClick={() => carregarCliente(c)}>
                            <p className="text-xs font-bold truncate">{c.cliente}</p>
                            <p className="text-[9px] text-muted-foreground truncate">
                              {c.banco || "—"} • {c.protocolo || "sem contrato"} • {c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : ""}
                            </p>
                          </button>
                          <div className="mt-1 flex items-center justify-between">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => carregarCliente(c)}>Carregar</Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => excluirCliente(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" /> Dados do contrato
                    </CardTitle>
                    <CardDescription>Preencha os dados do financiamento. Salve quantas simulações quiser.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Banco</Label>
                        <Input value={input.banco} onChange={(e) => setField("banco", e.target.value)} placeholder="Ex: BANCO ITAÚ" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contrato nº</Label>
                        <Input value={input.contrato} onChange={(e) => setField("contrato", e.target.value)} placeholder="Número do contrato" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</Label>
                      <Input value={input.cliente} onChange={(e) => setField("cliente", e.target.value)} placeholder="Nome do cliente" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nome da simulação</Label>
                      <Input value={nomeSimulacao} onChange={(e) => setNomeSimulacao(e.target.value)} placeholder="Ex: Cenário otimista" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor financiado (R$)</Label>
                        <Input inputMode="decimal" value={input.valor} onChange={(e) => setField("valor", e.target.value)} placeholder="Ex: 30000" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parcelas</Label>
                        <Input inputMode="numeric" value={input.parcelas} onChange={(e) => setField("parcelas", e.target.value)} placeholder="60" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Juros contratual (% a.a.)</Label>
                        <Input inputMode="decimal" value={input.jurosAnual} onChange={(e) => setField("jurosAnual", e.target.value)} placeholder="24" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Juros revisado (% a.a.)</Label>
                        <Input inputMode="decimal" value={input.jurosRevisado} onChange={(e) => setField("jurosRevisado", e.target.value)} placeholder="12" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CET (% a.a.)</Label>
                        <Input inputMode="decimal" value={input.cetAnual} onChange={(e) => setField("cetAnual", e.target.value)} placeholder="Opicional" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">1ª parcela (data)</Label>
                        <Input type="date" value={input.dataInicio} onChange={(e) => setField("dataInicio", e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["price", "sac"] as Plano[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setField("plano", p)}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                            input.plano === p
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {p === "price" ? "Tabela Price" : "SAC"}
                        </button>
                      ))}
                    </div>
                    <Button className="w-full" onClick={salvar} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Salvar simulação
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { setInput(emptyInput()); setSimulacaoAtivaId(null); setNomeSimulacao(""); }}>
                      <RefreshCcw className="mr-1.5 h-4 w-4" /> Limpar
                    </Button>
                  </CardContent>
                </Card>

                {simulacoes.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Simulações do cliente
                        <Badge variant="outline" className="ml-auto">{simulacoes.length}</Badge>
                      </CardTitle>
                      <CardDescription>Clique para alternar entre os cenários.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {simulacoes.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            "rounded-xl border p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-all",
                            s.id === simulacaoAtivaId ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/40"
                          )}
                          onClick={() => selecionarSimulacao(s)}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{s.nome}</p>
                            <p className="text-[9px] text-muted-foreground truncate">
                              {fmtBRL(s.resumo?.economia || 0)} de economia
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 shrink-0"
                            onClick={(e) => { e.stopPropagation(); excluirSimulacao(s.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" /> Taxa média de mercado (BACEN)
                    </CardTitle>
                    <CardDescription>Referência pública do Banco Central para fundamentar a revisão.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[220px] pr-1 space-y-1">
                      {TAXAS_BACEN.map((t) => (
                        <div key={t.modalidade} className="rounded-lg border border-border/60 p-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold truncate">{t.modalidade}</p>
                            <p className="text-[8px] text-muted-foreground">{t.periodo}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black tabular-nums">{t.taxaAa.toFixed(1)}% a.a.</span>
                            <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px]" onClick={() => setField("jurosRevisado", String(t.taxaAa))}>
                              Usar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                    {input.banco && taxaSugeridaPorModalidade(input.banco) ? (
                      <p className="mt-2 text-[9px] text-muted-foreground">
                        Sugestão p/ {input.banco}: {taxaSugeridaPorModalidade(input.banco)}% a.a.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              {/* Resultados */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard icon={<Receipt className="h-4 w-4" />} label="Parcela contratual" value={fmtBRL(resultado.parcelaContratual)} hint={`${input.plano.toUpperCase()} — por mês`} />
                  <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Parcela revisada" value={fmtBRL(resultado.parcelaRevisada)} hint="Juros revisado" tone="primary" />
                  <KpiCard icon={<PiggyBank className="h-4 w-4" />} label="Economia total" value={fmtBRL(economia)} hint={`${economiaPct.toFixed(1)}% do total`} tone={economia > 0 ? "ok" : "default"} />
                  <KpiCard icon={<Landmark className="h-4 w-4" />} label="Total contratual" value={fmtBRL(resultado.totalContratual)} hint={`${input.parcelas} parcelas`} />
                  <KpiCard icon={<Landmark className="h-4 w-4" />} label="Total revisado" value={fmtBRL(resultado.totalRevisado)} hint="Cenário revisado" />
                  <KpiCard icon={<Percent className="h-4 w-4" />} label="Juros mês" value={`${resultado.jurosMensal.toFixed(3)}%`} hint="Taxa contratual mensal" />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" /> Comparativo Price × SAC
                    </CardTitle>
                    <CardDescription>Mesmos dados aplicados nos dois sistemas de amortização.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(["price", "sac"] as Plano[]).map((modo) => {
                        const r = modo === "price" ? resultado : resultadoSac;
                        return (
                          <div key={modo} className={cn("rounded-xl border p-4", modo === input.plano ? "border-primary/50 bg-primary/5" : "border-border/70")}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{modo === "price" ? "Tabela Price" : "SAC"}</p>
                            <div className="mt-3 space-y-2 text-xs">
                              <p className="flex justify-between"><span className="text-muted-foreground">Parcela (1ª)</span><b className="tabular-nums">{fmtBRL(r.parcelaContratual)}</b></p>
                              <p className="flex justify-between"><span className="text-muted-foreground">Parcela revisada</span><b className="tabular-nums text-primary">{fmtBRL(r.parcelaRevisada)}</b></p>
                              <p className="flex justify-between"><span className="text-muted-foreground">Total contratual</span><b className="tabular-nums">{fmtBRL(r.totalContratual)}</b></p>
                              <p className="flex justify-between"><span className="text-muted-foreground">Economia</span><b className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(r.economia)}</b></p>
                            </div>
                            <Button
                              variant={modo === input.plano ? "default" : "outline"}
                              size="sm"
                              className="mt-3 w-full h-7 text-[10px]"
                              onClick={() => setField("plano", modo)}
                            >
                              {modo === input.plano ? "Sistema em uso" : "Usar este sistema"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {input.banco || input.cliente ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumo da análise
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p><b className="text-foreground">Banco:</b> {input.banco || "—"} {input.contrato ? `• Contrato ${input.contrato}` : ""}</p>
                      <p><b className="text-foreground">Cliente:</b> {input.cliente || "—"}</p>
                      <p><b className="text-foreground">Período:</b> {resultado.primeiraParcela} até {resultado.ultimaParcela}</p>
                      {input.cetAnual ? <p><b className="text-foreground">CET:</b> {parseNum(input.cetAnual).toFixed(2)}% a.a.</p> : null}
                    </CardContent>
                  </Card>
                ) : null}

                {economia > 0 ? (
                  <Card className="border-emerald-500/30">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <AlertTriangle className="h-4 w-4" /> Potencial de revisão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="text-muted-foreground">
                        Reduzindo os juros de <b className="text-foreground">{parseNum(input.jurosAnual).toFixed(2)}%</b> para{" "}
                        <b className="text-foreground">{parseNum(input.jurosRevisado).toFixed(2)}%</b> a.a., o cliente economiza{" "}
                        <b className="text-emerald-600 dark:text-emerald-400">{fmtBRL(economia)}</b> ao longo de{" "}
                        {input.parcelas} parcelas — {economiaPct.toFixed(1)}% do custo total do contrato.
                      </p>
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" /> Planilha de evolução ({input.plano === "price" ? "Tabela Price" : "SAC"})
                      <Badge variant="outline" className="ml-auto">{linhas.length} parcelas</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[380px] rounded-xl border border-border/70">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-card">
                          <tr className="border-b border-border">
                            <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Parcela</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Valor</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Juros</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Amortização</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest text-muted-foreground text-[9px]">Saldo devedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map((l) => (
                            <tr key={l.n} className={cn("border-b border-border/40", l.n % 2 === 0 && "bg-muted/20")}>
                              <td className="px-3 py-1.5 font-semibold tabular-nums">{l.n}</td>
                              <td className="px-3 py-1.5 tabular-nums">{fmtBRL(l.parcela)}</td>
                              <td className="px-3 py-1.5 tabular-nums text-amber-600 dark:text-amber-400">{fmtBRL(l.juros)}</td>
                              <td className="px-3 py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(l.amortizacao)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{fmtBRL(l.saldo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {minuta ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm font-black">Minuta — Petição Revisional</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copiarMinuta(minuta)}>
                      <Copy className="mr-1.5 h-4 w-4" /> Copiar
                    </Button>
                    <Button size="sm" onClick={() => imprimirMinuta(minuta)}>
                      <Printer className="mr-1.5 h-4 w-4" /> Imprimir / PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMinuta(null)}>Fechar</Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-6">
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-5 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {minuta}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
