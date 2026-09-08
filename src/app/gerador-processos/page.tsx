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
import { Download, Loader2, Filter, Search, ExternalLink, Copy, Check } from "lucide-react";

export default function GeradorProcessosPage() {
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [msg, setMsg] = useState("");
  const [dias, setDias] = useState("7");
  const [limite, setLimite] = useState("60");
  const [tribunal, setTribunal] = useState("TJSP");
  const [qLocal, setQLocal] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [ativos, setAtivos] = useState<FiltroRevisionalId[]>(() => filtrosDefaultOn());

  const toggle = (id: FiltroRevisionalId) => {
    setAtivos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const buscar = async () => {
    if (!ativos.length) {
      setMsg("Marque ao menos um filtro.");
      return;
    }
    setBusy(true);
    setMsg("Consultando DJEN…");
    try {
      const res = await buscarProcessosDjenRevisionalAction({
        filtros: ativos,
        dias: parseInt(dias, 10) || 7,
        limite: parseInt(limite, 10) || 60,
        siglaTribunal: tribunal.trim() || undefined,
        exigirNome: true,
      });
      setLista(res.items || []);
      setMsg(res.message || "");
    } catch (e: any) {
      setLista([]);
      setMsg(e?.message || "Erro DJEN");
    } finally {
      setBusy(false);
    }
  };

  const baixar = async () => {
    if (!lista.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(filtrados);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-consultavel-${filtrados.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExp(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = qLocal.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) =>
      [p.processo, p.nome_completo, p.classe, p.tribunal, p.situacao_hint, p.assunto_ou_teor]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [lista, qLocal]);

  const porTipo = useMemo(() => {
    const g: Record<string, typeof FILTROS_REVISIONAL> = { classe: [], assunto: [], resultado: [], fase: [] };
    for (const f of FILTROS_REVISIONAL) g[f.tipo].push(f);
    return g;
  }, []);

  const copyCnj = async (cnj: string) => {
    try {
      await navigator.clipboard.writeText(cnj);
      setCopied(cnj);
      setTimeout(() => setCopied(null), 1200);
    } catch { /* */ }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 md:p-6 space-y-4 border-b border-border/40 shrink-0">
          <header className="space-y-1 max-w-4xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/90">
              Só publicações consultáveis · sem sigilo · CNJ com DV
            </p>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">DJEN revisional</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Fonte: API Comunica PJe. Descarta segredo de justiça, CNJ inválido e teor vazio.
              Nome completo obrigatório na lista.
            </p>
          </header>

          <div className="flex flex-wrap gap-2">
            {FILTROS_REVISIONAL.map((f) => {
              const on = ativos.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={
                    "text-[11px] rounded-lg border px-2.5 py-1.5 transition " +
                    (on ? "border-primary bg-primary/20 font-semibold" : "border-border/50 text-muted-foreground")
                  }
                  title={f.tipo}
                >
                  {f.nomeTribunal}
                </button>
              );
            })}
            <Button type="button" variant="ghost" size="sm" className="text-[10px] uppercase font-black" onClick={() => setAtivos(filtrosDefaultOn())}>
              Padrão
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Dias</span>
              <Input className="h-9 w-16" value={dias} onChange={(e) => setDias(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Limite</span>
              <Input className="h-9 w-16" value={limite} onChange={(e) => setLimite(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Tribunal</span>
              <Input className="h-9 w-24 uppercase" value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="TJSP" />
            </label>
            <Button onClick={buscar} disabled={busy} className="h-9 gap-2 text-xs font-black uppercase">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar DJEN
            </Button>
            <Button variant="secondary" onClick={baixar} disabled={!filtrados.length || exp} className="h-9 gap-2 text-xs font-black uppercase">
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              XLSX ({filtrados.length})
            </Button>
            <label className="space-y-0.5 flex-1 min-w-[160px]">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Filtrar na lista</span>
              <Input className="h-9" placeholder="Nome, CNJ, classe…" value={qLocal} onChange={(e) => setQLocal(e.target.value)} />
            </label>
          </div>
          {!!msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>

        <div className="flex-1 overflow-auto p-2 md:p-4">
          {!filtrados.length && !busy && (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              Nada para mostrar. Busque no DJEN ou afrouxe o filtro local.
            </div>
          )}
          <div className="grid gap-2 md:gap-3">
            {filtrados.map((p) => (
              <article
                key={p.processo + p.data + p.link}
                className="rounded-xl border border-border/50 bg-card/50 p-3 md:p-4 hover:border-primary/40 transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyCnj(p.processo)}
                        className="font-mono text-sm font-bold inline-flex items-center gap-1 hover:text-primary"
                        title="Copiar CNJ"
                      >
                        {p.processo}
                        {copied === p.processo ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                      {p.tribunal && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-secondary">{p.tribunal}</span>
                      )}
                      {p.data && <span className="text-[10px] text-muted-foreground font-mono">{p.data}</span>}
                    </div>
                    <p className="text-sm font-semibold leading-snug">{p.nome_completo || "— sem nome —"}</p>
                    <p className="text-[11px] text-muted-foreground">{p.classe || "Classe não informada"}{p.situacao_hint ? ` · ${p.situacao_hint}` : ""}</p>
                  </div>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold uppercase text-primary border border-primary/30 rounded-lg px-3 py-2 hover:bg-primary/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir no DJEN
                    </a>
                  )}
                </div>
                {p.assunto_ou_teor && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground line-clamp-3 border-t border-border/30 pt-2">
                    {p.assunto_ou_teor}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
