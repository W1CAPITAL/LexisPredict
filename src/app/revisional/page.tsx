"use client";

/**
 * Revisional Admin — análise de revisão de contrato bancário.
 * Campos: contrato, valor financiado, parcelas, taxa juros, CET, data.
 * Gera planilha de evolução (tabela Price), projeções e resumo de economia.
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
} from "lucide-react";
import {
  listarClientesOperacaoAction,
  salvarClienteOperacaoAction,
  excluirClienteOperacaoAction,
} from "@/app/actions/clientes-operacao-actions";

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

function calcularPlanilha(input: RevisionalInput): {
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
} {
  const valor = parseNum(input.valor);
  const n = Math.max(1, Math.floor(parseNum(input.parcelas)));
  const jurosAnual = parseNum(input.jurosAnual) / 100;
  const jurosRev = parseNum(input.jurosRevisado) / 100;
  const iContratual = Math.pow(1 + jurosAnual, 1 / 12) - 1;
  const iRevisado = Math.pow(1 + jurosRev, 1 / 12) - 1;

  const parcelaContratual = valor > 0 && iContratual > 0
    ? (valor * iContratual) / (1 - Math.pow(1 + iContratual, -n))
    : n > 0 ? valor / n : 0;
  const parcelaRevisada = valor > 0 && iRevisado > 0
    ? (valor * iRevisado) / (1 - Math.pow(1 + iRevisado, -n))
    : n > 0 ? valor / n : 0;

  let saldo = valor;
  const linhas: LinhaPlanilha[] = [];
  for (let k = 1; k <= n; k++) {
    const juros = saldo * iContratual;
    const amortizacao = parcelaContratual - juros;
    saldo = Math.max(0, saldo - amortizacao);
    linhas.push({ n: k, parcela: parcelaContratual, juros, amortizacao, saldo });
  }

  const totalContratual = parcelaContratual * n;
  const totalRevisado = parcelaRevisada * n;
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
  const [saved, setSaved] = useState<RevisionalInput | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const resultado = useMemo(() => calcularPlanilha(input), [input]);
  const { linhas, economia, economiaPct } = resultado;

  const setField = (k: keyof RevisionalInput, v: string) =>
    setInput((prev) => ({ ...prev, [k]: v }));

  const salvar = async () => {
    setSaved(input);
    setSaving(true);
    const res = await salvarClienteOperacaoAction({
      tipo: 'revisional',
      cliente: input.cliente || input.contrato || 'Cliente sem nome',
      banco: input.banco,
      protocolo: input.contrato,
      dados: {
        input,
        resultado: {
          valorFinanciado: resultado.valorFinanciado,
          parcelaContratual: resultado.parcelaContratual,
          parcelaRevisada: resultado.parcelaRevisada,
          totalContratual: resultado.totalContratual,
          totalRevisado: resultado.totalRevisado,
          economia,
          economiaPct,
          jurosMensal: resultado.jurosMensal,
          jurosRevisadoMensal: resultado.jurosRevisadoMensal,
          primeiraParcela: resultado.primeiraParcela,
          ultimaParcela: resultado.ultimaParcela,
        },
      },
    });
    setSaving(false);
    if (res?.success) {
      const list = await listarClientesOperacaoAction('revisional');
      if (list?.success) setClientes(list.items || []);
      toast({ title: "Análise salva", description: res.message || "Registrada no Supabase." });
    } else {
      toast({
        title: "Salva apenas localmente",
        description: res?.error || "Não foi possível gravar no Supabase.",
        variant: "destructive",
      });
    }
  };

  const carregarCliente = (c: any) => {
    const dados = c?.dados;
    if (dados?.input) {
      const next = { ...emptyInput(), ...dados.input };
      setInput(next);
      setSaved(next);
      toast({ title: "Análise carregada", description: c.cliente });
    } else {
      toast({ title: "Registro sem simulação", description: "Este cliente não possui dados de cálculo salvos.", variant: "destructive" });
    }
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
                <h1 className="text-2xl font-black tracking-tight">Revisional Admin</h1>
                <p className="text-xs text-muted-foreground">
                  Análise de revisão de contrato bancário — planilha de evolução, juros e economia.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={!linhas.length}>
                  <FileDown className="mr-1.5 h-4 w-4" /> Exportar CSV
                </Button>
                <Button size="sm" onClick={salvar} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Salvar análise
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
                    <CardDescription>Clique para recarregar uma análise do Supabase.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {clientes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma análise salva ainda. Use "Salvar análise" para registrar.</p>
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
                  <CardDescription>
                    Preencha os dados do financiamento para gerar a planilha de evolução.
                  </CardDescription>
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
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { setInput(emptyInput()); setSaved(null); }}>
                    <RefreshCcw className="mr-1.5 h-4 w-4" /> Limpar
                  </Button>
                </CardContent>
                </Card>
              </div>

              {/* Resultados */}
              <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <KpiCard icon={<Receipt className="h-4 w-4" />} label="Parcela contratual" value={fmtBRL(resultado.parcelaContratual)} hint="Por mês" />
                  <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Parcela revisada" value={fmtBRL(resultado.parcelaRevisada)} hint="Juros revisado" tone="primary" />
                  <KpiCard icon={<PiggyBank className="h-4 w-4" />} label="Economia total" value={fmtBRL(economia)} hint={`${economiaPct.toFixed(1)}% do total`} tone={economia > 0 ? "ok" : "default"} />
                  <KpiCard icon={<Landmark className="h-4 w-4" />} label="Total contratual" value={fmtBRL(resultado.totalContratual)} hint={`${input.parcelas} parcelas`} />
                  <KpiCard icon={<Landmark className="h-4 w-4" />} label="Total revisado" value={fmtBRL(resultado.totalRevisado)} hint="Cenário revisado" />
                  <KpiCard icon={<Percent className="h-4 w-4" />} label="Juros mês" value={`${resultado.jurosMensal.toFixed(3)}%`} hint="Taxa contratual mensal" />
                </div>

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
                        <b className="text-foreground">{parseNum(input.jurosRevisado).toFixed(2)}%</b> a.a.,                         o cliente economiza{" "}
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
        </main>
      </div>
    </div>
  );
}
