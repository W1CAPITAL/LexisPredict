"use client";

import { calcularDash, type TituloFinanceiro } from "@/lib/financeiro-dashboard";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FinanceiroMiniDash({
  titulos,
  className,
}: {
  titulos: TituloFinanceiro[];
  className?: string;
}) {
  const d = calcularDash(titulos);
  const cards = [
    { label: "Recebido no mês", value: brl(d.recebidoMes), tone: "text-emerald-700" },
    { label: "Previsto no mês", value: brl(d.previstoMes), tone: "text-foreground" },
    { label: "Em aberto", value: brl(d.emAberto), tone: "text-amber-700" },
    { label: "Atrasado", value: brl(d.atrasado), tone: "text-red-700" },
  ];
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border/40 bg-card/60 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{c.label}</p>
          <p className={cn("text-lg font-black tabular-nums mt-1", c.tone)}>{c.value}</p>
        </div>
      ))}
      <div className="col-span-2 lg:col-span-4 text-[10px] text-muted-foreground font-medium">
        Taxa de recebimento no mês:{" "}
        <strong className="text-foreground">{(d.taxaRecebimentoMes * 100).toFixed(0)}%</strong>
        {" · "}
        {d.qtdAtrasados} título(s) atrasado(s)
      </div>
    </div>
  );
}
