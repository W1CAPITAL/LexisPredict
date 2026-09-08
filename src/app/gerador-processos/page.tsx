"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarProcessosDjenRevisionalAction } from "@/app/actions/gerador-djen-action";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
import {
  FILTROS_REVISIONAL,
  filtrosDefaultOn,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Loader2, Filter, Search, ExternalLink } from "lucide-react";

export default function GeradorProcessosPage() {
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [msg, setMsg] = useState("");
  const [dias, setDias] = useState("14");
  const [limite, setLimite] = useState("100");
  const [tribunal, setTribunal] = useState("");
  const [ativos, setAtivos] = useState<FiltroRevisionalId[]>(() => filtrosDefaultOn());

  const toggle = (id: FiltroRevisionalId) => {
    setAtivos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const buscar = async () => {
    if (!ativos.length) {
      setMsg("Marque ao menos um filtro.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await buscarProcessosDjenRevisionalAction({
        filtros: ativos,
        dias: parseInt(dias, 10) || 14,
        limite: parseInt(limite, 10) || 100,
        siglaTribunal: tribunal.trim() || undefined,
      });
      setLista(res.items || []);
      setMsg(res.message || (res.success ? "OK" : "Sem resultados"));
    } catch (e: any) {
      setMsg(e?.message || "Erro na busca DJEN");
      setLista([]);
    } finally {
      setBusy(false);
    }
  };

  const baixar = async () => {
    if (!lista.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(lista);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-revisional-real-${lista.length}.xlsx`;
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
            DJEN · Comunica PJe (processos reais)
          </p>
          <h1 className="text-2xl font-black tracking-tight">DJEN revisional</h1>
          <p className="text-sm text-muted-foreground">
            Busca <strong>publicações reais</strong> na API oficial do DJEN.
            CNJ e nome completo vêm da comunicação (não são inventados).
            Filtros: Procedimento Comum Cível, revisional, alienação fiduciária,
            extinção sem resolução do mérito, etc. Não grava no banco — só lista e exporta.
          </p>
        </header>

        <section className="max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            Filtros (nome de tribunal)
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="text-[10px] font-black uppercase" onClick={() => setAtivos(filtrosDefaultOn())}>
              Padrão revisional
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-[10px] font-black uppercase" onClick={() => setAtivos((p) => (p.includes("extinto_sem_merito") ? p : [...p, "extinto_sem_merito"]))}>
              + Extinto sem resolução do mérito
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dias (máx. 90)</span>
            <Input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} className="w-24 h-10" maxLength={2} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limite CNJs</span>
            <Input inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value)} className="w-24 h-10" maxLength={3} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tribunal (opcional)</span>
            <Input placeholder="TJSP" value={tribunal} onChange={(e) => setTribunal(e.target.value)} className="w-28 h-10 uppercase" maxLength={8} />
          </label>
          <Button onClick={buscar} disabled={busy} className="h-10 gap-2 font-black uppercase text-xs">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar no DJEN
          </Button>
          <Button variant="secondary" onClick={baixar} disabled={!lista.length || exp} className="h-10 gap-2 font-black uppercase text-xs">
            {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar xlsx
          </Button>
        </div>

        {!!msg && <p className="text-sm text-muted-foreground max-w-3xl">{msg}</p>}

        {!!lista.length && (
          <div className="rounded-2xl border border-border/50 overflow-hidden max-w-6xl">
            <div className="max-h-[480px] overflow-auto text-xs">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-secondary/90 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-2">Processo</th>
                    <th className="p-2">Nome completo</th>
                    <th className="p-2">Classe</th>
                    <th className="p-2">Tribunal</th>
                    <th className="p-2">Data</th>
                    <th className="p-2">Situação / filtro</th>
                    <th className="p-2">Link</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {lista.map((p) => (
                    <tr key={p.processo + p.data} className="border-t border-border/30 align-top">
                      <td className="p-2 whitespace-nowrap">{p.processo}</td>
                      <td className="p-2 font-sans">{p.nome_completo || "—"}</td>
                      <td className="p-2 font-sans">{p.classe || "—"}</td>
                      <td className="p-2">{p.tribunal}</td>
                      <td className="p-2 whitespace-nowrap">{p.data}</td>
                      <td className="p-2 font-sans text-[11px]">{p.situacao_hint || "—"}</td>
                      <td className="p-2">
                        {p.link ? (
                          <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                            <ExternalLink className="w-3 h-3" /> DJEN
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
