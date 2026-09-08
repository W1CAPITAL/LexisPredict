"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrichmentConfigAction, scanDjenPaginaAction } from "@/app/actions/gerador-djen-action";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
import {
  FILTROS_REVISIONAL,
  filtrosDefaultOn,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Loader2, Search, ExternalLink, Copy, Check, Square, Phone, Mail } from "lucide-react";

const MAX_PAG_POR_QUERY = 25;
const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoInicioPadrao = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function GeradorProcessosPage() {
  const [alvo, setAlvo] = useState("60");
  const [tribunal, setTribunal] = useState("TJSP");
  const [dataInicio, setDataInicio] = useState(isoInicioPadrao);
  const [dataFim, setDataFim] = useState(isoHoje);
  const [ativos, setAtivos] = useState<FiltroRevisionalId[]>(() => filtrosDefaultOn());
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [qLocal, setQLocal] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [enrichOn, setEnrichOn] = useState(false);
  const [enrichCfg, setEnrichCfg] = useState<{ ready: boolean; enabled: boolean; urlSet: boolean; tokenSet: boolean } | null>(null);
  const stopRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    enrichmentConfigAction().then(setEnrichCfg).catch(() => null);
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const pushLogs = (more: ScanLogLine[]) => setLogs((prev) => [...prev, ...more].slice(-500));

  const filtrados = useMemo(() => {
    const q = qLocal.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) =>
      [p.processo, p.nome_completo, p.telefone, p.email, p.cpf, p.classe].join(" ").toLowerCase().includes(q)
    );
  }, [lista, qLocal]);

  const iniciarScan = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!dataInicio || !dataFim || dataInicio > dataFim) {
      pushLogs([{ ts: "", level: "err", text: "Escolha um intervalo válido: início deve ser anterior ao fim." }]);
      return;
    }
    if (!ativos.length) {
      pushLogs([{ ts: "", level: "err", text: "Marque pelo menos um filtro." }]);
      return;
    }
    stopRef.current = false;
    setBusy(true);
    setLista([]);
    setLogs([]);
    const cfg = await enrichmentConfigAction().catch(() => null);
    setEnrichCfg(cfg);
    const willEnrich = enrichOn && !!cfg?.ready;
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: "info",
        text: `Alvo ${target} · enrich ${willEnrich ? "ON (sua API)" : "OFF"} · sem sigilo · AUTOR`,
      },
    ]);
    if (enrichOn && cfg && !cfg.ready) {
      pushLogs([
        {
          ts: new Date().toISOString().slice(11, 19),
          level: "warn",
          text: `API enrich não pronta (enabled=${cfg.enabled} url=${cfg.urlSet} token=${cfg.tokenSet}). Defina ENRICHMENT_LOOKUP_* no Vercel.`,
        },
      ]);
    }

    const byCnj = new Map<string, ProcessoDjenReal>();
    const nQueries = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id)).length;

    outer: for (const janela of [{ dataInicio, dataFim }]) {
      if (stopRef.current || byCnj.size >= target) break;
      pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "info", text: `— Intervalo ${janela.dataInicio} até ${janela.dataFim} · ${byCnj.size}/${target} —` }]);

      for (let qi = 0; qi < nQueries; qi++) {
        if (stopRef.current || byCnj.size >= target) break outer;
        let pagina = 1;
        let paginasSemBruto = 0;

        while (pagina <= MAX_PAG_POR_QUERY && byCnj.size < target && !stopRef.current) {
          let res = await scanDjenPaginaAction({
            filtros: ativos,
            queryIndex: qi,
            pagina,
              dataInicio: janela.dataInicio,
              dataFim: janela.dataFim,
              siglaTribunal: tribunal.trim() || undefined,
            excludeCnjs: [...byCnj.keys()],
            enrich: willEnrich,
          });
          pushLogs(res.logs || []);
          if (res.geoBlocked) break outer;

          let retries = 0;
          while (res.rateLimited && retries < 6 && !stopRef.current) {
            retries++;
            pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "warn", text: `429 — espera ${2 + retries}s` }]);
            await new Promise((r) => setTimeout(r, (2 + retries) * 1000));
            res = await scanDjenPaginaAction({
              filtros: ativos,
              queryIndex: qi,
              pagina,
              dataInicio: janela.dataInicio,
              dataFim: janela.dataFim,
              siglaTribunal: tribunal.trim() || undefined,
              excludeCnjs: [...byCnj.keys()],
              enrich: willEnrich,
            });
            pushLogs(res.logs || []);
          }

          let added = 0;
          for (const it of res.items || []) {
            const dig = it.processo.replace(/\D/g, "");
            if (byCnj.has(dig)) continue;
            byCnj.set(dig, it);
            added++;
            if (byCnj.size >= target) break;
          }
          if (added) {
            setLista([...byCnj.values()]);
            pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "ok", text: `Progresso ${byCnj.size}/${target} (+${added})` }]);
          }

          if (res.bruto === 0) {
            paginasSemBruto++;
            if (paginasSemBruto >= 2) break;
          } else paginasSemBruto = 0;

          if (!res.hasMore && res.bruto < 80) break;
          pagina += 1;
          // O scanner é deliberadamente serial: uma comunicação por segundo,
          // com progresso e log somente após a resposta real do DJEN.
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (byCnj.size >= target) break;
    }

    setLista([...byCnj.values()]);
    const vals = [...byCnj.values()];
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: byCnj.size >= target ? "ok" : "warn",
        text: `Fim · ${byCnj.size}/${target} · tel ${vals.filter((x) => x.telefone).length} · email ${vals.filter((x) => x.email).length} · cpf ${vals.filter((x) => x.cpf).length}`,
      },
    ]);
    setBusy(false);
  };

  const baixar = async () => {
    if (!filtrados.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(filtrados);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-enrich-${filtrados.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExp(false);
    }
  };

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(t);
      setTimeout(() => setCopied(null), 1000);
    } catch { /* */ }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 border-b border-border/50 space-y-3 shrink-0">
          <div>
            <h1 className="text-xl font-black tracking-tight">DJEN revisional</h1>
            <p className="text-xs text-muted-foreground">
              Scan até o alvo + enrichment opcional (tel, e-mail, CPF, endereço) via{" "}
              <strong>sua API</strong> (<code className="text-[10px]">ENRICHMENT_LOOKUP_*</code>).
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTROS_REVISIONAL.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAtivos((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                className={"text-[11px] rounded-lg border px-2 py-1 " + (ativos.includes(f.id) ? "border-primary bg-primary/20 font-semibold" : "border-border/40 text-muted-foreground")}
              >
                {f.nomeTribunal}
              </button>
            ))}
            <button type="button" className="text-[10px] uppercase font-black text-muted-foreground px-2" onClick={() => setAtivos(filtrosDefaultOn())}>padrão</button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Alvo</span>
              <Input className="h-9 w-20 font-bold" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Tribunal</span>
              <Input className="h-9 w-24 uppercase" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Início</span>
              <Input className="h-9 w-36" type="date" value={dataInicio} max={dataFim} onChange={(e) => setDataInicio(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Fim</span>
              <Input className="h-9 w-36" type="date" value={dataFim} min={dataInicio} max={isoHoje()} onChange={(e) => setDataFim(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 h-9 px-2 rounded-lg border border-border/50 text-xs cursor-pointer">
              <input type="checkbox" checked={enrichOn} onChange={(e) => setEnrichOn(e.target.checked)} />
              Enrich API
              <span className={"text-[9px] font-bold " + (enrichCfg?.ready ? "text-emerald-500" : "text-amber-500")}>
                {enrichCfg == null ? "…" : enrichCfg.ready ? "pronta" : "não configurada"}
              </span>
            </label>
            {!busy ? (
              <Button onClick={iniciarScan} className="h-9 gap-2 text-xs font-black uppercase"><Search className="w-4 h-4" /> Buscar até o alvo</Button>
            ) : (
              <Button onClick={() => { stopRef.current = true; }} variant="destructive" className="h-9 gap-2 text-xs font-black uppercase"><Square className="w-3.5 h-3.5" /> Parar</Button>
            )}
            <Button variant="secondary" onClick={baixar} disabled={!filtrados.length || exp} className="h-9 gap-2 text-xs font-black uppercase">
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} XLSX
            </Button>
            <Input className="h-9 flex-1 min-w-[140px]" placeholder="Filtrar…" value={qLocal} onChange={(e) => setQLocal(e.target.value)} />
          </div>

          <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap gap-3">
            <span className="text-foreground font-bold">{lista.length}/{alvo}</span>
            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {lista.filter((p) => p.telefone).length} tel</span>
            <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {lista.filter((p) => p.email).length} email</span>
            <span>cpf {lista.filter((p) => p.cpf).length}</span>
            {busy && <span className="text-amber-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> scan…</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_300px] overflow-hidden">
          <div className="overflow-auto p-3 space-y-2">
            {filtrados.map((p) => (
              <article key={p.processo} className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="font-mono text-sm font-bold inline-flex items-center gap-1" onClick={() => copy(p.processo)}>
                        {p.processo}
                        {copied === p.processo ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                      <span className="text-[10px] font-black uppercase bg-secondary px-1.5 py-0.5 rounded">{p.tribunal || "—"}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{p.data}</span>
                    </div>
                    <p className="text-sm font-semibold">{p.nome_completo}</p>
                    <div className="text-[11px] space-y-0.5 text-muted-foreground">
                      {p.telefone && <p className="text-emerald-600 dark:text-emerald-400 font-mono"><Phone className="w-3 h-3 inline" /> {p.telefone} <span className="opacity-60">({p.telefone_fonte || "—"})</span></p>}
                      {p.email && <p className="font-mono"><Mail className="w-3 h-3 inline" /> {p.email}</p>}
                      {p.cpf && <p className="font-mono">CPF {p.cpf}</p>}
                      {p.cnpj && <p className="font-mono">CNPJ {p.cnpj}</p>}
                      {(p.endereco || p.municipio) && (
                        <p>{[p.endereco, p.bairro, p.municipio, p.uf, p.cep].filter(Boolean).join(" · ")}</p>
                      )}
                      {p.enrich_fonte && <p className="text-[9px] uppercase tracking-wide">enrich: {p.enrich_fonte}</p>}
                      <p>{p.classe || "—"}{p.situacao_hint ? ` · ${p.situacao_hint}` : ""}</p>
                    </div>
                  </div>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-primary border border-primary/30 rounded-lg px-3 py-2 h-fit inline-flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> DJEN
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
          <aside className="border-t md:border-t-0 md:border-l border-border/50 flex flex-col overflow-hidden bg-black/20">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40">Log</div>
            <div className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-1">
              {logs.map((l, i) => (
                <div key={i} className={l.level === "err" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : l.level === "ok" ? "text-emerald-400" : "text-slate-300"}>
                  {l.ts && <span className="opacity-50">{l.ts} </span>}{l.text}
                </div>
              ))}
              <div ref={logEnd} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
