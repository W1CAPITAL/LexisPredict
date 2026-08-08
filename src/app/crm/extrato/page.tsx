"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  crmExtratoMesAction,
  crmRelatorioPorServicoAction,
  listAtrasadosAction,
  type CrmExtratoLinha,
} from "@/app/actions/crm-actions";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CrmExtratoPage() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [linhas, setLinhas] = useState<CrmExtratoLinha[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [porServico, setPorServico] = useState<any[]>([]);
  const [atrasados, setAtrasados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [e, r, a] = await Promise.all([
      crmExtratoMesAction(mes),
      crmRelatorioPorServicoAction(),
      listAtrasadosAction(),
    ]);
    setLinhas(e.linhas || []);
    setSaldo(e.saldo || 0);
    setPorServico(r.rows || []);
    setAtrasados(a.rows || []);
    setLoading(false);
  }, [mes]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/crm">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-black">Extrato & margem</h1>
                <p className="text-xs text-muted-foreground">Fluxo do mês, receita por serviço e atrasados</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[160px] h-9" />
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Saldo do mês (pagos)</p>
            <p className={cn("text-3xl font-black tabular-nums", saldo >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {loading ? "…" : brl(saldo)}
            </p>
          </div>

          <section>
            <h2 className="text-sm font-black uppercase tracking-wide mb-2">Por serviço</h2>
            <div className="space-y-2">
              {porServico.map((s) => (
                <div key={s.servico} className="rounded-xl border border-border bg-card p-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold">{s.servico}</p>
                    <p className="text-xs text-muted-foreground">{s.qtd} negócio(s)</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Receita {brl(s.receita)}</p>
                    <p className="text-muted-foreground">Custo {brl(s.custo)}</p>
                    <p className="font-black">Margem {brl(s.margem)}</p>
                  </div>
                </div>
              ))}
              {porServico.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">Sem dados de serviços.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-wide mb-2">
              Atrasados ({atrasados.length})
            </h2>
            <div className="space-y-2">
              {atrasados.map((r) => (
                <div key={r.id} className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 p-3 flex justify-between">
                  <div>
                    <p className="font-bold text-sm">{r.cliente_nome || r.descricao}</p>
                    <p className="text-xs text-muted-foreground">Venc. {r.vencimento}</p>
                  </div>
                  <p className="font-black tabular-nums">{brl(Number(r.valor))}</p>
                </div>
              ))}
              {atrasados.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">Nenhum título atrasado.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-wide mb-2">Movimentos do mês</h2>
            {loading ? (
              <Loader2 className="animate-spin text-muted-foreground" />
            ) : (
              <ul className="space-y-1">
                {linhas.map((l) => (
                  <li
                    key={l.id + l.tipo}
                    className="flex justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <div>
                      <Badge variant={l.tipo === "entrada" ? "default" : "secondary"} className="mr-2">
                        {l.tipo}
                      </Badge>
                      <span className="font-medium">{l.descricao}</span>
                      <span className="text-xs text-muted-foreground ml-2">{l.data}</span>
                    </div>
                    <span className={cn("font-black tabular-nums", l.tipo === "entrada" ? "text-emerald-600" : "text-rose-600")}>
                      {l.tipo === "entrada" ? "+" : "−"}
                      {brl(l.valor)}
                    </span>
                  </li>
                ))}
                {linhas.length === 0 && <p className="text-sm text-muted-foreground">Sem movimentos pagos neste mês.</p>}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
