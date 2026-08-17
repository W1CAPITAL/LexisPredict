"use client";

/**
 * Cálculos judiciais — fluxo simples para devolução de tarifa/seguro / liquidação.
 * 1) Cola a sentença (ou preenche na mão)
 * 2) Confirma valores e datas
 * 3) Calcula
 */

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { parseSentencaParaCalculo } from "@/lib/parse-sentenca-calculo";
import { Calculator, Copy, Sparkles, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalculosPage() {
  const { toast } = useToast();

  // texto da decisão
  const [textoSentenca, setTextoSentenca] = useState("");
  const [dicas, setDicas] = useState<string[]>([]);

  // campos simples (o que o usuário realmente preenche)
  const [valor1, setValor1] = useState(""); // tarifa
  const [data1, setData1] = useState("2023-04-14");
  const [label1, setLabel1] = useState("Tarifa / taxa cobrada");
  const [valor2, setValor2] = useState(""); // seguro
  const [data2, setData2] = useState("2023-04-14");
  const [label2, setLabel2] = useState("Seguro");
  const [dataCitacao, setDataCitacao] = useState("2025-09-01");
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [indice, setIndice] = useState<IndiceCodigo>("TJSP");
  const [jurosPct, setJurosPct] = useState("1");
  const [honPct, setHonPct] = useState("10");
  const [art523, setArt523] = useState(false);

  const [resultado, setResultado] = useState<CalculoResultado | null>(null);

  const lerSentenca = () => {
    const d = parseSentencaParaCalculo(textoSentenca);
    setDicas(d.resumo);
    if (d.indice === "TJSP") setIndice("TJSP");
    else if (d.indice === "IPCA") setIndice("IPCA");
    else if (d.indice === "IGPM") setIndice("IGPM");
    else if (d.indice === "INPC") setIndice("INPC");
    if (d.jurosMensalPct != null) setJurosPct(String(d.jurosMensalPct));
    if (d.honorariosPct != null) setHonPct(String(d.honorariosPct));

    // preenche valores: prioriza tarifa e seguro
    const tarifa = d.valores.find((v) => /tarif/i.test(v.label));
    const seguro = d.valores.find((v) => /seguro/i.test(v.label));
    const outros = d.valores.filter((v) => v !== tarifa && v !== seguro);
    if (tarifa) {
      setValor1(String(tarifa.valor).replace(".", ","));
      setLabel1("Tarifa");
    } else if (outros[0]) {
      setValor1(String(outros[0].valor).replace(".", ","));
      setLabel1(outros[0].label);
    }
    if (seguro) {
      setValor2(String(seguro.valor).replace(".", ","));
      setLabel2("Seguro");
    } else if (outros[1]) {
      setValor2(String(outros[1].valor).replace(".", ","));
      setLabel2(outros[1].label);
    }
    toast({
      title: "Texto lido",
      description: d.resumo[0] || "Confira os campos e complete as datas de pagamento.",
    });
  };

  const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

  const calcular = () => {
    const parcelas = [];
    if (num(valor1) > 0) {
      parcelas.push({ descricao: label1, valor: num(valor1), data: data1 });
    }
    if (num(valor2) > 0) {
      parcelas.push({ descricao: label2, valor: num(valor2), data: data2 });
    }
    if (!parcelas.length) {
      toast({ title: "Informe ao menos um valor", variant: "destructive" });
      return;
    }
    const res = executarCalculoJudicial({
      nome: "Devolução / liquidação",
      indice,
      dataFinal,
      parcelas,
      juros: {
        taxaMensalPct: num(jurosPct) || 1,
        dataInicio: dataCitacao,
        proRata: true,
      },
      honorarios: num(honPct) > 0 ? { percentual: num(honPct), base: "subtotal" } : null,
      art523,
    });
    setResultado(res);
    toast({ title: "Estimativa pronta", description: formatBRL(res.totalGeral) });
  };

  const copiar = async () => {
    if (!resultado) return;
    const lines = [
      "ESTIMATIVA LEXIS — NÃO É PLANILHA FINAL DE LIQUIDAÇÃO",
      `Índice: ${resultado.indice} (aproximado)`,
      `Principal original: ${formatBRL(resultado.principalOriginal)}`,
      `Corrigido: ${formatBRL(resultado.principalCorrigido)}`,
      `Juros (desde citação): ${formatBRL(resultado.totalJuros)}`,
      `Subtotal: ${formatBRL(resultado.subtotal)}`,
      `Honorários ${honPct}%: ${formatBRL(resultado.honorarios)}`,
      resultado.multa523 || resultado.honorarios523 ? `Art. 523: ${formatBRL(resultado.multa523 + resultado.honorarios523)}` : "",
      `TOTAL ESTIMADO: ${formatBRL(resultado.totalGeral)}`,
      "",
      "Confira datas de desembolso e citação nos autos. Tabela TJSP oficial pode divergir.",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(lines);
    toast({ title: "Copiado" });
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-5">
          <header>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-black">Quanto o cliente pode receber?</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Para casos de devolução de <strong>tarifa</strong>, <strong>seguro</strong> ou valores da sentença.
              Cole o texto do juiz ou preencha os valores na mão.
            </p>
          </header>

          {/* PASSO 1 */}
          <section className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-primary">1 · Texto da decisão (opcional)</p>
            <textarea
              className="w-full min-h-[120px] rounded-xl border bg-background p-3 text-sm"
              placeholder="Cole aqui o texto da sentença / intimação do DJEN (ex.: JULGO PROCEDENTE… tarifa… seguro… correção pela Tabela Prática do TJSP… juros de 1% ao mês desde a citação… honorários 10%…)"
              value={textoSentenca}
              onChange={(e) => setTextoSentenca(e.target.value)}
            />
            <Button type="button" variant="secondary" className="gap-1.5" onClick={lerSentenca} disabled={!textoSentenca.trim()}>
              <Sparkles className="h-4 w-4" />
              Ler decisão e preencher
            </Button>
            {dicas.length > 0 && (
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                {dicas.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </section>

          {/* PASSO 2 */}
          <section className="rounded-2xl border bg-card p-4 space-y-4">
            <p className="text-xs font-black uppercase tracking-wide text-primary">2 · Valores a devolver</p>
            <p className="text-[11px] text-muted-foreground flex gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Use a data em que o cliente <strong>pagou</strong> (desembolso), não a data da sentença. Ex.: data da contratação/desembolso no contrato (neste caso 14/04/2023).
            </p>

            <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
              <Label className="text-xs">{label1}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Valor R$</Label>
                  <Input value={valor1} onChange={(e) => setValor1(e.target.value)} placeholder="4900,00" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Data do pagamento</Label>
                  <Input type="date" value={data1} onChange={(e) => setData1(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
              <Label className="text-xs">{label2} (se tiver)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Valor R$</Label>
                  <Input value={valor2} onChange={(e) => setValor2(e.target.value)} placeholder="23522,30" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Data do pagamento</Label>
                  <Input type="date" value={data2} onChange={(e) => setData2(e.target.value)} />
                </div>
              </div>
            </div>
          </section>

          {/* PASSO 3 */}
          <section className="rounded-2xl border bg-card p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-primary">3 · Regras da sentença</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px]">Correção (índice)</Label>
                <Select value={indice} onValueChange={(v) => setIndice(v as IndiceCodigo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TJSP">Tabela TJSP (aprox.)</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                    <SelectItem value="INPC">INPC</SelectItem>
                    <SelectItem value="IGPM">IGP-M</SelectItem>
                    <SelectItem value="SELIC">SELIC</SelectItem>
                    <SelectItem value="NENHUM">Sem correção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Juros % ao mês</Label>
                <Input value={jurosPct} onChange={(e) => setJurosPct(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Início dos juros (citação)</Label>
                <Input type="date" value={dataCitacao} onChange={(e) => setDataCitacao(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Calcular até</Label>
                <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px]">Honorários advocatícios %</Label>
                <Input value={honPct} onChange={(e) => setHonPct(e.target.value)} />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  id="a523"
                  checked={art523}
                  onChange={(e) => setArt523(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="a523" className="text-[11px] leading-tight">
                  Já em cumprimento sem pagamento? (art. 523: +10% +10%)
                </Label>
              </div>
            </div>

            <Button className="w-full h-11 font-black uppercase text-xs tracking-widest" onClick={calcular}>
              Calcular estimativa
            </Button>
          </section>

          {resultado && (
            <section className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black text-sm">Estimativa para o cliente</h2>
                <Badge variant="outline">{resultado.indice}</Badge>
              </div>
              <p className="text-3xl font-black tabular-nums text-primary">
                {formatBRL(resultado.totalGeral)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Inclui correção + juros + honorários
                {art523 ? " + art. 523" : ""}. Ainda depende de trânsito / recurso e da planilha oficial.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Só o que pagou</p>
                  <p className="font-bold">{formatBRL(resultado.principalOriginal)}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Com correção</p>
                  <p className="font-bold">{formatBRL(resultado.principalCorrigido)}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Juros</p>
                  <p className="font-bold">{formatBRL(resultado.totalJuros)}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-muted-foreground">Honorários {honPct}%</p>
                  <p className="font-bold">{formatBRL(resultado.honorarios)}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={copiar}>
                <Copy className="h-3.5 w-3.5" /> Copiar resumo
              </Button>
            </section>
          )}

          <p className="text-[10px] text-muted-foreground pb-8">
            Contrato Bradesco (CCB 16.136.016, 14/04/2023): tarifa R$ 4.900 + seguro R$ 23.522,30 = R$ 28.422,30
            desde 14/04/2023 (não use 2016). Tabela TJSP + juros 1% a.m. desde a citação + honorários 10%.
            Com apelação pendente, o total é só estimativa — cobrança após trânsito (ou execução provisória, se cabível).
          </p>
        </div>
      </main>
    </div>
  );
}
