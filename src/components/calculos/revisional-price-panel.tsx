
"use client";

import React, { useMemo, useState } from "react";
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
import { fetchTaxaBacenAction } from "@/app/actions/bacen-actions";
import {
  compararTaxaContratoVsMedia,
  formatBRL,
  gerarCronograma,
  type SistemaAmort,
} from "@/lib/amortizacao-price-sac";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Landmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function num(s: string): number {
  return (
    Number(
      String(s)
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    ) || 0
  );
}

export function RevisionalPricePanel() {
  const [sistema, setSistema] = useState<SistemaAmort>("PRICE");
  const [pv, setPv] = useState("50000");
  const [n, setN] = useState("48");
  const [taxaContrato, setTaxaContrato] = useState("2.5");
  const [taxaMedia, setTaxaMedia] = useState("");
  const [dataContrato, setDataContrato] = useState("2023-01-15");
  const [modalidade, setModalidade] = useState("VEICULOS_PF");
  const [loadingBacen, setLoadingBacen] = useState(false);
  const [bacenMeta, setBacenMeta] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const resultado = useMemo(() => {
    const valor = num(pv);
    const parcelas = Math.min(360, Math.max(1, Math.floor(num(n) || 1)));
    const tc = num(taxaContrato);
    const tm = num(taxaMedia);
    if (valor <= 0 || tc <= 0) return null;
    if (tm <= 0) {
      return {
        onlyContrato: true as const,
        crono: gerarCronograma(sistema, valor, tc, parcelas),
      };
    }
    return {
      onlyContrato: false as const,
      cmp: compararTaxaContratoVsMedia({
        sistema,
        valorFinanciado: valor,
        taxaContratoPct: tc,
        taxaMediaBacenPct: tm,
        nParcelas: parcelas,
      }),
    };
  }, [sistema, pv, n, taxaContrato, taxaMedia]);

  const puxarBacen = async () => {
    setLoadingBacen(true);
    try {
      const res = await fetchTaxaBacenAction({
        modalidade: modalidade as any,
        dataContrato,
      });
      if (!res.success || res.valor == null) {
        toast({
          title: "Bacen",
          description: res.error || "Sem dados",
          variant: "destructive",
        });
        return;
      }
      setTaxaMedia(String(res.valor).replace(".", ","));
      setBacenMeta(`${res.label} · ref. ${res.data} · ${res.valor}% a.m.`);
      toast({ title: "Taxa média Bacen carregada", description: res.label });
    } finally {
      setLoadingBacen(false);
    }
  };

  const parcelasPreview =
    resultado && !resultado.onlyContrato
      ? resultado.cmp.contrato.parcelas
      : resultado && resultado.onlyContrato
        ? resultado.crono.parcelas
        : [];

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-4 md:p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Landmark className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">
            Revisional · Price / SAC + Bacen
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Triagem matemática para o operador. Não é consulta jurídica automatizada
            (Provimento OAB 205/2021), não promete resultado de ação e não substitui
            perícia. Média Bacen via API pública SGS — gratuita, sem token.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Sistema</Label>
          <Select value={sistema} onValueChange={(v) => setSistema(v as SistemaAmort)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRICE">Tabela Price</SelectItem>
              <SelectItem value="SAC">SAC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Valor financiado R$</Label>
          <Input className="h-10 font-semibold" value={pv} onChange={(e) => setPv(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Nº de parcelas</Label>
          <Input className="h-10" value={n} onChange={(e) => setN(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Taxa contrato % a.m.</Label>
          <Input className="h-10 font-semibold" value={taxaContrato} onChange={(e) => setTaxaContrato(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Data do contrato</Label>
          <Input className="h-10" type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Modalidade Bacen</Label>
          <Select value={modalidade} onValueChange={setModalidade}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VEICULOS_PF">Veículos PF (25471)</SelectItem>
              <SelectItem value="CREDITO_PESSOAL">Crédito pessoal (20742)</SelectItem>
              <SelectItem value="CHEQUE_ESPECIAL">Cheque especial (25463)</SelectItem>
              <SelectItem value="MEDIA_GERAL">Média geral (20714)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-[10px] uppercase text-muted-foreground">Taxa média Bacen % a.m.</Label>
          <Input
            className="h-10"
            placeholder="Buscar ou digitar"
            value={taxaMedia}
            onChange={(e) => setTaxaMedia(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" disabled={loadingBacen} onClick={puxarBacen} className="h-10">
          {loadingBacen ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Buscar média no Bacen (grátis)
        </Button>
      </div>
      {bacenMeta && <p className="text-[11px] text-muted-foreground">{bacenMeta}</p>}

      {resultado?.onlyContrato && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
          <p className="font-bold">Cronograma (contrato)</p>
          <p>1ª prestação: <strong>{formatBRL(resultado.crono.parcelas[0]?.prestacao || 0)}</strong></p>
          <p>Total pago: <strong>{formatBRL(resultado.crono.totalPago)}</strong></p>
          <p>Total juros: <strong>{formatBRL(resultado.crono.totalJuros)}</strong></p>
        </div>
      )}

      {resultado && !resultado.onlyContrato && (
        <div
          className={cn(
            "rounded-xl border p-4 space-y-2",
            resultado.cmp.sinalizaAbusividadeOperacional
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-border bg-muted/20"
          )}
        >
          {resultado.cmp.sinalizaAbusividadeOperacional && (
            <p className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Taxa &gt; 1,5× média Bacen (limiar {resultado.cmp.limiar}% a.m.) — triagem, não presunção absoluta
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Contrato</p>
              <p>Total: <strong>{formatBRL(resultado.cmp.contrato.totalPago)}</strong></p>
              <p>Juros: <strong>{formatBRL(resultado.cmp.contrato.totalJuros)}</strong></p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Taxa = média Bacen</p>
              <p>Total: <strong>{formatBRL(resultado.cmp.media.totalPago)}</strong></p>
              <p>Juros: <strong>{formatBRL(resultado.cmp.media.totalJuros)}</strong></p>
            </div>
          </div>
          <p className="text-sm">
            Diferença: <strong>{formatBRL(resultado.cmp.diferencaTotalPago)}</strong>
            {" · "}razão: <strong>{resultado.cmp.razaoTaxas}×</strong>
          </p>
        </div>
      )}

      {parcelasPreview.length > 0 && (
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Ver menos parcelas" : "Ver cronograma completo"}
          </Button>
          <div className="max-h-56 overflow-auto rounded-lg border text-xs">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="text-left">
                  <th className="p-2">Nº</th>
                  <th className="p-2">Prestação</th>
                  <th className="p-2">Juros</th>
                  <th className="p-2">Amort.</th>
                  <th className="p-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? parcelasPreview : parcelasPreview.slice(0, 6)).map((row) => (
                  <tr key={row.n} className="border-t border-border/40">
                    <td className="p-2 tabular-nums">{row.n}</td>
                    <td className="p-2 tabular-nums">{formatBRL(row.prestacao)}</td>
                    <td className="p-2 tabular-nums">{formatBRL(row.juros)}</td>
                    <td className="p-2 tabular-nums">{formatBRL(row.amortizacao)}</td>
                    <td className="p-2 tabular-nums">{formatBRL(row.saldoApos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
