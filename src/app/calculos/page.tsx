"use client";

/**
 * Aba Cálculos Judiciais — atualização / liquidação (estilo JusCalc), escopo Lexis.
 */

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  executarCalculoJudicial,
  formatBRL,
  type CalculoResultado,
  type IndiceCodigo,
} from "@/lib/calculos-judiciais";
import { Calculator, Plus, Trash2, Copy, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ParcelaUI = { id: string; descricao: string; valor: string; data: string };

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function CalculosPage() {
  const { toast } = useToast();
  const [nome, setNome] = useState("Atualização / liquidação");
  const [indice, setIndice] = useState<IndiceCodigo>("IPCA");
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [parcelas, setParcelas] = useState<ParcelaUI[]>([
    { id: "1", descricao: "Principal / condenação", valor: "", data: todayISO() },
  ]);
  const [jurosAtivo, setJurosAtivo] = useState(true);
  const [taxaJuros, setTaxaJuros] = useState("1");
  const [dataJuros, setDataJuros] = useState(todayISO());
  const [multaPct, setMultaPct] = useState("");
  const [honPct, setHonPct] = useState("10");
  const [art523, setArt523] = useState(false);
  const [custaValor, setCustaValor] = useState("");
  const [custaData, setCustaData] = useState(todayISO());
  const [abatValor, setAbatValor] = useState("");
  const [resultado, setResultado] = useState<CalculoResultado | null>(null);

  const podeCalcular = useMemo(
    () => parcelas.some((p) => Number(p.valor) > 0 && p.data),
    [parcelas]
  );

  const calcular = () => {
    const res = executarCalculoJudicial({
      nome,
      indice,
      dataFinal,
      parcelas: parcelas
        .filter((p) => Number(p.valor) > 0)
        .map((p) => ({
          descricao: p.descricao,
          valor: Number(String(p.valor).replace(",", ".")),
          data: p.data,
        })),
      juros: jurosAtivo
        ? {
            taxaMensalPct: Number(String(taxaJuros).replace(",", ".")) || 0,
            dataInicio: dataJuros,
            proRata: true,
          }
        : null,
      multa: Number(multaPct) > 0 ? { percentual: Number(multaPct), sobreJuros: true } : null,
      honorarios: Number(honPct) > 0 ? { percentual: Number(honPct), base: "subtotal" } : null,
      art523,
      custas:
        Number(custaValor) > 0
          ? [{ valor: Number(String(custaValor).replace(",", ".")), data: custaData, descricao: "Custas" }]
          : [],
      abatimentos:
        Number(abatValor) > 0
          ? [{ valor: Number(String(abatValor).replace(",", ".")), data: dataFinal, descricao: "Abatimento" }]
          : [],
    });
    setResultado(res);
    toast({ title: "Cálculo concluído", description: formatBRL(res.totalGeral) });
  };

  const copiarResumo = async () => {
    if (!resultado) return;
    const t = [
      resultado.nome,
      `Data final: ${resultado.dataFinal}`,
      `Índice: ${resultado.indice}`,
      `Principal original: ${formatBRL(resultado.principalOriginal)}`,
      `Principal corrigido: ${formatBRL(resultado.principalCorrigido)}`,
      `Juros: ${formatBRL(resultado.totalJuros)}`,
      `Subtotal: ${formatBRL(resultado.subtotal)}`,
      `Multa: ${formatBRL(resultado.multa)}`,
      `Honorários: ${formatBRL(resultado.honorarios)}`,
      `Multa 523: ${formatBRL(resultado.multa523)}`,
      `Honorários 523: ${formatBRL(resultado.honorarios523)}`,
      `Custas: ${formatBRL(resultado.custas)}`,
      `Abatimentos: ${formatBRL(resultado.abatimentos)}`,
      `TOTAL: ${formatBRL(resultado.totalGeral)}`,
      "",
      ...resultado.avisos,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(t);
      toast({ title: "Resumo copiado" });
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">Cálculos judiciais</h1>
                <p className="text-xs text-muted-foreground">
                  Atualização monetária, juros, multa, honorários, art. 523, custas e abatimentos — alinhado à operação de cumprimento.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Índices usam fator mensal <strong>aproximado</strong> (triagem operacional). Para peça formal, confira índice da sentença e série oficial (BCB/contadoria).
              </span>
            </div>
          </header>

          <section className="rounded-2xl border bg-card p-4 md:p-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Nome do cálculo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data final</Label>
                <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Índice de correção</Label>
                <Select value={indice} onValueChange={(v) => setIndice(v as IndiceCodigo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["IPCA", "INPC", "IGPM", "SELIC", "CDI", "TR", "NENHUM"] as IndiceCodigo[]).map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Parcelas / principal</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  onClick={() =>
                    setParcelas((p) => [
                      ...p,
                      {
                        id: String(Date.now()),
                        descricao: `Parcela ${p.length + 1}`,
                        valor: "",
                        data: dataFinal,
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Parcela
                </Button>
              </div>
              {parcelas.map((p, idx) => (
                <div key={p.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-5 space-y-1">
                    <Label className="text-[10px]">Descrição</Label>
                    <Input
                      value={p.descricao}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParcelas((all) => all.map((x, i) => (i === idx ? { ...x, descricao: v } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-5 md:col-span-3 space-y-1">
                    <Label className="text-[10px]">Valor (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={p.valor}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParcelas((all) => all.map((x, i) => (i === idx ? { ...x, valor: v } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-5 md:col-span-3 space-y-1">
                    <Label className="text-[10px]">Data</Label>
                    <Input
                      type="date"
                      value={p.data}
                      onChange={(e) => {
                        const v = e.target.value;
                        setParcelas((all) => all.map((x, i) => (i === idx ? { ...x, data: v } : x)));
                      }}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={parcelas.length <= 1}
                      onClick={() => setParcelas((all) => all.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={jurosAtivo} onCheckedChange={(c) => setJurosAtivo(!!c)} id="juros" />
                  <Label htmlFor="juros">Juros de mora (simples % a.m.)</Label>
                </div>
                {jurosAtivo && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Taxa % a.m.</Label>
                      <Input value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Início mora</Label>
                      <Input type="date" value={dataJuros} onChange={(e) => setDataJuros(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[10px]">Multa extra %</Label>
                  <Input value={multaPct} onChange={(e) => setMultaPct(e.target.value)} placeholder="ex. 10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Honorários sucumbência %</Label>
                  <Input value={honPct} onChange={(e) => setHonPct(e.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={art523} onCheckedChange={(c) => setArt523(!!c)} id="art523" />
                  <Label htmlFor="art523">Art. 523 CPC (multa 10% + honorários 10%)</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Custas (R$)</Label>
                    <Input value={custaValor} onChange={(e) => setCustaValor(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Data custas</Label>
                    <Input type="date" value={custaData} onChange={(e) => setCustaData(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Abatimento (R$)</Label>
                  <Input value={abatValor} onChange={(e) => setAbatValor(e.target.value)} />
                </div>
              </div>
            </div>

            <Button className="w-full h-11 font-black uppercase tracking-widest text-xs" disabled={!podeCalcular} onClick={calcular}>
              Calcular
            </Button>
          </section>

          {resultado && (
            <section className="rounded-2xl border bg-card p-4 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black text-sm uppercase tracking-wide">Resultado</h2>
                <div className="flex gap-2">
                  <Badge variant="outline">{resultado.indice}</Badge>
                  <Button type="button" size="sm" variant="outline" className="gap-1" onClick={copiarResumo}>
                    <Copy className="h-3.5 w-3.5" /> Copiar resumo
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Original", resultado.principalOriginal],
                  ["Corrigido", resultado.principalCorrigido],
                  ["Juros", resultado.totalJuros],
                  ["Subtotal", resultado.subtotal],
                  ["Multa", resultado.multa],
                  ["Honorários", resultado.honorarios],
                  ["Art. 523", resultado.multa523 + resultado.honorarios523],
                  ["TOTAL", resultado.totalGeral],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
                    <p className="text-sm font-black tabular-nums">{formatBRL(Number(val))}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2">Data</th>
                      <th className="p-2 text-right">Original</th>
                      <th className="p-2 text-right">Fator</th>
                      <th className="p-2 text-right">Corrigido</th>
                      <th className="p-2 text-right">Juros</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{l.tipo}</td>
                        <td className="p-2">{l.descricao}</td>
                        <td className="p-2 whitespace-nowrap">{l.dataRef}</td>
                        <td className="p-2 text-right tabular-nums">{formatBRL(l.valorOriginal)}</td>
                        <td className="p-2 text-right tabular-nums">{l.fatorCorrecao.toFixed(4)}</td>
                        <td className="p-2 text-right tabular-nums">{formatBRL(l.valorCorrigido)}</td>
                        <td className="p-2 text-right tabular-nums">{formatBRL(l.juros)}</td>
                        <td className="p-2 text-right tabular-nums font-semibold">{formatBRL(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultado.avisos.map((a, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">
                  • {a}
                </p>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
