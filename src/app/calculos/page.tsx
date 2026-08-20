"use client";

/**
 * Cálculos — interface simples: 3 passos, linguagem clara, resultado em destaque.
 */

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Calculator,
  Copy,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RevisionalPricePanel } from "@/components/calculos/revisional-price-panel";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function num(s: string) {
  return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
}

export default function CalculosPage() {
  const { toast } = useToast();

  const [showPaste, setShowPaste] = useState(false);
  const [textoSentenca, setTextoSentenca] = useState("");
  const [dicas, setDicas] = useState<string[]>([]);

  const [valorTarifa, setValorTarifa] = useState("");
  const [dataTarifa, setDataTarifa] = useState("2023-04-14");
  const [valorSeguro, setValorSeguro] = useState("");
  const [dataSeguro, setDataSeguro] = useState("2023-04-14");
  const [valorOutro, setValorOutro] = useState("");
  const [dataOutro, setDataOutro] = useState(todayISO());
  const [labelOutro, setLabelOutro] = useState("Outro valor");

  const [dataCitacao, setDataCitacao] = useState("2025-09-01");
  const [dataFinal, setDataFinal] = useState(todayISO());
  const [indice, setIndice] = useState<IndiceCodigo>("TJSP");
  const [jurosPct, setJurosPct] = useState("1");
  const [honPct, setHonPct] = useState("10");
  const [art523, setArt523] = useState(false);

  const [resultado, setResultado] = useState<CalculoResultado | null>(null);

  const totalDigitado = useMemo(() => {
    return num(valorTarifa) + num(valorSeguro) + num(valorOutro);
  }, [valorTarifa, valorSeguro, valorOutro]);

  const lerSentenca = () => {
    const d = parseSentencaParaCalculo(textoSentenca);
    setDicas(d.resumo);
    if (d.indice === "TJSP" || d.indice === "IPCA" || d.indice === "IGPM" || d.indice === "INPC") {
      setIndice(d.indice as IndiceCodigo);
    }
    if (d.jurosMensalPct != null) setJurosPct(String(d.jurosMensalPct));
    if (d.honorariosPct != null) setHonPct(String(d.honorariosPct));

    const tarifa = d.valores.find((v) => /tarif/i.test(v.label));
    const seguro = d.valores.find((v) => /seguro/i.test(v.label));
    const outros = d.valores.filter((v) => v !== tarifa && v !== seguro);
    if (tarifa) setValorTarifa(String(tarifa.valor));
    else if (outros[0]) setValorTarifa(String(outros[0].valor));
    if (seguro) setValorSeguro(String(seguro.valor));
    else if (outros[1]) {
      setValorOutro(String(outros[1].valor));
      setLabelOutro(outros[1].label);
    }
    toast({
      title: "Pronto — confira os números abaixo",
      description: "Ajuste as datas do pagamento se precisar.",
    });
    setShowPaste(false);
  };

  const usarExemploBradesco = () => {
    setValorTarifa("4900");
    setDataTarifa("2023-04-14");
    setValorSeguro("23522.30");
    setDataSeguro("2023-04-14");
    setIndice("TJSP");
    setJurosPct("1");
    setHonPct("10");
    setDataCitacao("2025-09-01");
    setArt523(false);
    toast({ title: "Exemplo carregado", description: "Tarifa + seguro do contrato 14/04/2023" });
  };

  const calcular = () => {
    const parcelas: { descricao: string; valor: number; data: string }[] = [];
    if (num(valorTarifa) > 0)
      parcelas.push({ descricao: "Tarifa", valor: num(valorTarifa), data: dataTarifa });
    if (num(valorSeguro) > 0)
      parcelas.push({ descricao: "Seguro", valor: num(valorSeguro), data: dataSeguro });
    if (num(valorOutro) > 0)
      parcelas.push({ descricao: labelOutro || "Outro", valor: num(valorOutro), data: dataOutro });

    if (!parcelas.length) {
      toast({ title: "Digite pelo menos um valor", variant: "destructive" });
      return;
    }

    const res = executarCalculoJudicial({
      nome: "Estimativa para o cliente",
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
    // scroll to result
    setTimeout(() => {
      document.getElementById("resultado-calculo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const copiar = async () => {
    if (!resultado) return;
    const t = [
      "ESTIMATIVA (Lexis) — confirme com planilha oficial",
      `O cliente pagou: ${formatBRL(resultado.principalOriginal)}`,
      `Com correção (${resultado.indice}): ${formatBRL(resultado.principalCorrigido)}`,
      `Com juros: ${formatBRL(resultado.subtotal)}`,
      `Honorários: ${formatBRL(resultado.honorarios)}`,
      resultado.multa523 + resultado.honorarios523 > 0
        ? `Art. 523: ${formatBRL(resultado.multa523 + resultado.honorarios523)}`
        : "",
      `TOTAL ESTIMADO: ${formatBRL(resultado.totalGeral)}`,
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(t);
    toast({ title: "Copiado" });
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto px-4 pt-4 md:px-6"><RevisionalPricePanel /></div>

        <div className="max-w-lg mx-auto p-4 md:p-6 space-y-4 pb-16">
          {/* Cabeçalho */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary mb-2">
              <Calculator className="h-3.5 w-3.5" />
              Calculadora rápida
            </div>
            <h1 className="text-xl font-black tracking-tight leading-tight">
              Quanto o banco pode ter que devolver?
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Informe o que foi cobrado indevido. O app atualiza com correção, juros e honorários.
            </p>
          </div>

          {/* Atalhos */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="rounded-full h-8 text-xs" onClick={usarExemploBradesco}>
              Exemplo: tarifa + seguro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full h-8 text-xs gap-1"
              onClick={() => setShowPaste((v) => !v)}
            >
              {showPaste ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Colei o texto do juiz
            </Button>
          </div>

          {showPaste && (
            <div className="rounded-2xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Cole a sentença ou a intimação. O app tenta achar juros, honorários e valores em R$.
              </p>
              <textarea
                className="w-full min-h-[100px] rounded-xl border bg-background p-3 text-sm"
                placeholder="Cole aqui…"
                value={textoSentenca}
                onChange={(e) => setTextoSentenca(e.target.value)}
              />
              <Button type="button" size="sm" className="gap-1" disabled={!textoSentenca.trim()} onClick={lerSentenca}>
                <Sparkles className="h-3.5 w-3.5" />
                Preencher automaticamente
              </Button>
              {dicas.length > 0 && (
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                  {dicas.slice(0, 6).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Passo 1 — valores */}
          <section className="rounded-2xl border-2 border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-primary/5 px-4 py-2.5 border-b flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-black">
                1
              </span>
              <div>
                <p className="text-sm font-bold">O que o cliente pagou a mais?</p>
                <p className="text-[10px] text-muted-foreground">Use a data do contrato ou do pagamento, não a da sentença</p>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <MoneyRow
                title="Tarifa / taxa"
                hint="No contrato Bradesco costuma ser o item “Tarifas”"
                value={valorTarifa}
                onValue={setValorTarifa}
                date={dataTarifa}
                onDate={setDataTarifa}
              />
              <MoneyRow
                title="Seguro"
                hint="Ex.: seguro prestamista embutido no financiamento"
                value={valorSeguro}
                onValue={setValorSeguro}
                date={dataSeguro}
                onDate={setDataSeguro}
              />
              <MoneyRow
                title={labelOutro}
                hint="Opcional — outro valor da sentença"
                value={valorOutro}
                onValue={setValorOutro}
                date={dataOutro}
                onDate={setDataOutro}
              />
              {totalDigitado > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Soma digitada: <strong className="text-foreground">{formatBRL(totalDigitado)}</strong>
                </p>
              )}
            </div>
          </section>

          {/* Passo 2 — regras */}
          <section className="rounded-2xl border-2 border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-primary/5 px-4 py-2.5 border-b flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-black">
                2
              </span>
              <div>
                <p className="text-sm font-bold">O que o juiz determinou?</p>
                <p className="text-[10px] text-muted-foreground">Na dúvida, deixe os padrões (TJSP + 1% + 10%)</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-[11px]">Correção do dinheiro (inflação)</Label>
                <Select value={indice} onValueChange={(v) => setIndice(v as IndiceCodigo)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TJSP">Tabela do TJSP (mais comum em SP)</SelectItem>
                    <SelectItem value="IPCA">IPCA</SelectItem>
                    <SelectItem value="INPC">INPC</SelectItem>
                    <SelectItem value="IGPM">IGP-M</SelectItem>
                    <SelectItem value="NENHUM">Sem correção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Juros ao mês</Label>
                <Input className="h-10" value={jurosPct} onChange={(e) => setJurosPct(e.target.value)} inputMode="decimal" />
                <p className="text-[9px] text-muted-foreground">Quase sempre 1%</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Desde quando conta o juro?</Label>
                <Input className="h-10" type="date" value={dataCitacao} onChange={(e) => setDataCitacao(e.target.value)} />
                <p className="text-[9px] text-muted-foreground">Data da citação do banco</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Calcular até</Label>
                <Input className="h-10" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">% do advogado (honorários)</Label>
                <Input className="h-10" value={honPct} onChange={(e) => setHonPct(e.target.value)} inputMode="decimal" />
              </div>
              <label className="col-span-2 flex items-start gap-2 rounded-xl border p-3 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={art523}
                  onChange={(e) => setArt523(e.target.checked)}
                />
                <span className="text-xs leading-snug">
                  <strong>Já passou o prazo de pagar e o banco não pagou?</strong>
                  <span className="block text-muted-foreground mt-0.5">
                    Marque só em cumprimento de sentença (multa + honorários extras de 10%).
                  </span>
                </span>
              </label>
            </div>
          </section>

          <Button
            className="w-full h-12 rounded-2xl font-black text-sm tracking-wide shadow-md"
            onClick={calcular}
            disabled={totalDigitado <= 0}
          >
            Ver quanto dá
          </Button>

          {/* Resultado */}
          {resultado && (
            <section
              id="resultado-calculo"
              className="rounded-2xl border-2 border-primary/50 bg-card shadow-lg overflow-hidden"
            >
              <div className="bg-primary text-primary-foreground px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Estimativa para o cliente</p>
                <p className="text-3xl font-black tabular-nums tracking-tight mt-0.5">
                  {formatBRL(resultado.totalGeral)}
                </p>
              </div>
              <div className="p-4 space-y-3">
                <StoryLine
                  ok
                  title="O que foi pago"
                  value={formatBRL(resultado.principalOriginal)}
                />
                <StoryLine
                  ok
                  title="Depois da correção (inflação)"
                  value={formatBRL(resultado.principalCorrigido)}
                />
                <StoryLine
                  ok
                  title="Depois dos juros"
                  value={formatBRL(resultado.subtotal)}
                />
                <StoryLine
                  ok
                  title={`Honorários (${honPct}%)`}
                  value={formatBRL(resultado.honorarios)}
                />
                {(resultado.multa523 > 0 || resultado.honorarios523 > 0) && (
                  <StoryLine
                    ok
                    title="Extras do art. 523"
                    value={formatBRL(resultado.multa523 + resultado.honorarios523)}
                  />
                )}

                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-[11px] text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Isso é uma <strong>estimativa</strong> para conversa com o cliente. A planilha oficial (Tabela
                    Prática TJSP) pode variar um pouco. Se o processo ainda está em recurso, o valor ainda não está
                    liberado para cobrança.
                  </span>
                </div>

                <Button type="button" variant="outline" className="w-full gap-2 h-10" onClick={copiar}>
                  <Copy className="h-4 w-4" />
                  Copiar para colar no WhatsApp
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function MoneyRow({
  title,
  hint,
  value,
  onValue,
  date,
  onDate,
}: {
  title: string;
  hint: string;
  value: string;
  onValue: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Valor em R$</Label>
          <Input
            className="h-11 text-base font-semibold"
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(e) => onValue(e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Quando pagou</Label>
          <Input className="h-11" type="date" value={date} onChange={(e) => onDate(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function StoryLine({ title, value, ok }: { title: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        {title}
      </span>
      <span className={cn("font-bold tabular-nums")}>{value}</span>
    </div>
  );
}
