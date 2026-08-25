"use client";

/**
 * Clientes a receber / depósitos / cumprimento — import planilha W1.
 * Não conta como atendimento de operador.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listCarteiraValoresAction, type CarteiraValorRow } from "@/app/actions/carteira-valores-actions";
import { Loader2, RefreshCcw, Wallet } from "lucide-react";

const CAT_LABEL: Record<string, string> = {
  depositado_conta: "Já depositado em conta",
  transferido_cliente: "Transferido ao cliente",
  conferir_cliente: "Conferir com cliente",
  depositado_processo: "Depositado no processo",
  aguardando_cs: "Aguardando cumprimento",
  deposito_judicial: "Depósito judicial",
};

function money(v: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AReceberPage() {
  const [rows, setRows] = useState<CarteiraValorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const res = await listCarteiraValoresAction();
    if (!res.ok) setErr(res.error || "Falha");
    setRows(res.rows || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const byCat = useMemo(() => {
    const m = new Map<string, CarteiraValorRow[]>();
    for (const r of rows) {
      const k = r.categoria || "outros";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rows]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.valor) || 0), 0),
    [rows],
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5" /> CRM · Valores
            </p>
            <h1 className="text-xl font-bold tracking-tight">Clientes a receber / depósitos</h1>
            <p className="text-xs text-muted-foreground mt-1">
              W1 Control · Feito por Davi Alves Figueredo — não entra no ranking de atendimentos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {money(total)}
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {err ? (
          <p className="text-sm text-destructive">
            {err}
            {err.includes("carteira_valores") || err.includes("does not exist")
              ? " — rode o SQL SQL-W1-CONTROL-VALORES-CS.sql no Supabase."
              : null}
          </p>
        ) : null}

        {loading && !rows.length ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : null}

        {[...byCat.entries()].map(([cat, list]) => (
          <section key={cat} className="rounded-xl border bg-card/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{CAT_LABEL[cat] || cat}</h2>
              <span className="text-xs text-muted-foreground">
                {list.length} · {money(list.reduce((s, r) => s + (Number(r.valor) || 0), 0))}
              </span>
            </div>
            <ul className="divide-y divide-border/60">
              {list.map((r) => (
                <li key={r.id} className="py-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.cliente || "—"}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{r.protocolo_ref || "—"}</p>
                    {r.situacao ? (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.situacao}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0 font-semibold tabular-nums">{money(r.valor)}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!loading && !rows.length && !err ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum valor importado. Rode o SQL da planilha no Supabase.
          </p>
        ) : null}
      </main>
    </div>
  );
}
