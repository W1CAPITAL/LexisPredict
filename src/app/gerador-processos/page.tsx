"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCnj20, gerarLoteCnj } from "@/lib/gerar-cnj-aleatorio";
import { xlsxProcessosGerados } from "@/lib/xlsx-lista-cnj";
import {
  FILTROS_REVISIONAL,
  filtrosDefaultOn,
  montarProcessoGerado,
  type FiltroRevisionalId,
  type ProcessoGerado,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Hash, Loader2, Filter } from "lucide-react";

const TETO = 20000;

export default function GeradorProcessosPage() {
  const [qtd, setQtd] = useState("100");
  const [lista, setLista] = useState<ProcessoGerado[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [ativos, setAtivos] = useState<FiltroRevisionalId[]>(() => filtrosDefaultOn());

  const toggle = (id: FiltroRevisionalId) => {
    setAtivos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const gerar = () => {
    const n = Math.max(0, Math.min(TETO, parseInt(String(qtd).replace(/\D/g, ""), 10) || 0));
    if (!n) return;
    if (!ativos.length) {
      alert("Marque ao menos um filtro (classe/assunto/situação).");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const cnjs = gerarLoteCnj(n, TETO).map(formatCnj20);
      setLista(cnjs.map((c) => montarProcessoGerado(c, ativos)));
      setBusy(false);
    }, 20);
  };

  const baixar = async () => {
    if (!lista.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosGerados(lista);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `revisional-filtros-${lista.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExp(false);
    }
  };

  const porTipo = useMemo(() => {
    const g: Record<string, typeof FILTROS_REVISIONAL> = {
      classe: [],
      assunto: [],
      resultado: [],
      fase: [],
    };
    for (const f of FILTROS_REVISIONAL) g[f.tipo].push(f);
    return g;
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 space-y-6 overflow-y-auto">
        <header className="max-w-3xl space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Ferramenta local
          </p>
          <h1 className="text-2xl font-black tracking-tight">Gerador de processos — revisional</h1>
          <p className="text-sm text-muted-foreground">
            CNJ válido + <strong>nome completo</strong> + classe/assunto no padrão de capa de tribunal
            (Procedimento Comum Cível, revisional, alienação fiduciária, extinção sem mérito, etc.).
            Não grava no banco. Não consulta o tribunal de verdade — rotula o lote conforme os filtros.
          </p>
        </header>

        <section className="max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            Filtros (nome como no tribunal)
          </div>

          {(
            [
              ["classe", "Classe processual"],
              ["assunto", "Assunto / matéria"],
              ["resultado", "Resultado / extinção"],
              ["fase", "Fase"],
            ] as const
          ).map(([tipo, titulo]) => (
            <div key={tipo} className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{titulo}</p>
              <div className="flex flex-wrap gap-2">
                {porTipo[tipo].map((f) => {
                  const on = ativos.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(f.id)}
                      className={
                        "text-left text-xs rounded-xl border px-3 py-2 max-w-xs transition " +
                        (on
                          ? "border-primary bg-primary/15 text-foreground font-semibold"
                          : "border-border/50 text-muted-foreground hover:border-border")
                      }
                    >
                      {f.nomeTribunal}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[10px] font-black uppercase"
              onClick={() => setAtivos(filtrosDefaultOn())}
            >
              Padrão revisional
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[10px] font-black uppercase"
              onClick={() =>
                setAtivos((prev) =>
                  prev.includes("extinto_sem_merito")
                    ? prev
                    : [...prev, "extinto_sem_merito"]
                )
              }
            >
              + Extinto sem resolução do mérito
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[10px] font-black uppercase"
              onClick={() => setAtivos(FILTROS_REVISIONAL.map((f) => f.id))}
            >
              Marcar todos
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Quantos processos
            </span>
            <Input
              inputMode="numeric"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="w-36 h-10"
              maxLength={5}
            />
          </label>
          <Button onClick={gerar} disabled={busy} className="h-10 gap-2 font-black uppercase text-xs">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
            Gerar lote
          </Button>
          <Button
            variant="secondary"
            onClick={baixar}
            disabled={!lista.length || exp}
            className="h-10 gap-2 font-black uppercase text-xs"
          >
            {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar xlsx
          </Button>
          {!!lista.length && (
            <span className="text-xs text-muted-foreground font-mono">{lista.length} linhas</span>
          )}
        </div>

        {!!lista.length && (
          <div className="rounded-2xl border border-border/50 overflow-hidden max-w-5xl">
            <div className="max-h-[420px] overflow-auto text-xs font-mono">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-secondary/90 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2">Processo</th>
                    <th className="p-2">Nome completo</th>
                    <th className="p-2">Classe</th>
                    <th className="p-2">Assunto</th>
                    <th className="p-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 200).map((p) => (
                    <tr key={p.processo} className="border-t border-border/30">
                      <td className="p-2 whitespace-nowrap">{p.processo}</td>
                      <td className="p-2">{p.nome_completo}</td>
                      <td className="p-2">{p.classe}</td>
                      <td className="p-2">{p.assunto}</td>
                      <td className="p-2">{p.situacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length > 200 && (
                <p className="p-2 text-muted-foreground text-[10px]">
                  Prévia 200 de {lista.length} — o xlsx traz todos.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
