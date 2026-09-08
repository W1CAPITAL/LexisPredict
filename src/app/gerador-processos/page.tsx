"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanDjenPaginaAction } from "@/app/actions/gerador-djen-action";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
import {
  FILTROS_REVISIONAL,
  filtrosDefaultOn,
  type FiltroRevisionalId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Loader2, Search, ExternalLink, Copy, Check, Square, Phone } from "lucide-react";

export default function GeradorProcessosPage() {
  const [alvo, setAlvo] = useState("60");
  const [dias, setDias] = useState("7");
  const [tribunal, setTribunal] = useState("TJSP");
  const [ativos, setAtivos] = useState<FiltroRevisionalId[]>(() => filtrosDefaultOn());
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const [qLocal, setQLocal] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const stopRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const toggle = (id: FiltroRevisionalId) => {
    setAtivos((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const pushLogs = (more: ScanLogLine[]) => setLogs((prev) => [...prev, ...more].slice(-400));

  const filtrados = useMemo(() => {
    const q = qLocal.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) =>
      [p.processo, p.nome_completo, p.telefone, p.classe, p.tribunal].join(" ").toLowerCase().includes(q)
    );
  }, [lista, qLocal]);

  const comTel = useMemo(() => lista.filter((p) => p.telefone).length, [lista]);

  /** Scan até atingir alvo (ex. 60), com logs ao vivo */
  const iniciarScan = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!ativos.length) {
      pushLogs([{ ts: "", level: "err", text: "Marque pelo menos um filtro." }]);
      return;
    }
    stopRef.current = false;
    setBusy(true);
    setLista([]);
    setLogs([]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: "info",
        text: `Início · alvo ${target} processos consultáveis · sem sigilo · nome obrigatório · telefone só se no teor DJEN`,
      },
    ]);

    const byCnj = new Map<string, ProcessoDjenReal>();
    const nQueries = FILTROS_REVISIONAL.filter((f) => ativos.includes(f.id)).length;
    let qi = 0;
    let pagina = 1;
    let emptyStreak = 0;
    let rateHits = 0;

    while (!stopRef.current && byCnj.size < target) {
      const exclude = [...byCnj.keys()];
      const res = await scanDjenPaginaAction({
        filtros: ativos,
        queryIndex: qi,
        pagina,
        dias: parseInt(dias, 10) || 7,
        siglaTribunal: tribunal.trim() || undefined,
        excludeCnjs: exclude,
      });
      pushLogs(res.logs || []);

      if (res.geoBlocked) break;
      if (res.rateLimited) {
        rateHits++;
        pushLogs([
          {
            ts: new Date().toISOString().slice(11, 19),
            level: "warn",
            text: `Aguardando 3s por rate limit (${rateHits})…`,
          },
        ]);
        await new Promise((r) => setTimeout(r, 3000));
        if (rateHits > 8) break;
        continue;
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
        pushLogs([
          {
            ts: new Date().toISOString().slice(11, 19),
            level: "ok",
            text: `Progresso ${byCnj.size}/${target} (+${added} nesta página)`,
          },
        ]);
        emptyStreak = 0;
      } else {
        emptyStreak++;
      }

      if (byCnj.size >= target) break;

      // próxima página ou próxima query
      if (res.hasMore && emptyStreak < 2) {
        pagina += 1;
      } else {
        qi += 1;
        pagina = 1;
        emptyStreak = 0;
        if (qi >= nQueries) {
          // segunda passagem: amplia dias mentalmente já está fixo — encerra
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "warn",
              text: `Esgotou queries/páginas com ${byCnj.size}/${target}. Amplie dias ou troque tribunal.`,
            },
          ]);
          break;
        }
        pushLogs([
          {
            ts: new Date().toISOString().slice(11, 19),
            level: "info",
            text: `Trocando para filtro ${qi + 1}/${nQueries}…`,
          },
        ]);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    setLista([...byCnj.values()]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: byCnj.size >= target ? "ok" : "warn",
        text: stopRef.current
          ? `Parado pelo usuário · ${byCnj.size} processos`
          : `Fim · ${byCnj.size}/${target} · com telefone no teor: ${[...byCnj.values()].filter((x) => x.telefone).length}`,
      },
    ]);
    setBusy(false);
  };

  const parar = () => {
    stopRef.current = true;
    pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "warn", text: "Parando após a página atual…" }]);
  };

  const baixar = async () => {
    if (!filtrados.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(filtrados);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-real-${filtrados.length}.xlsx`;
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
        {/* topo simples */}
        <div className="p-4 border-b border-border/50 space-y-3 shrink-0 bg-background/95">
          <div>
            <h1 className="text-xl font-black tracking-tight">DJEN revisional</h1>
            <p className="text-xs text-muted-foreground">
              Processos <strong>reais</strong> do Comunica. Sem sigilo. Sem inventar CNJ, nome ou telefone.
              Telefone só se estiver escrito na publicação.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTROS_REVISIONAL.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={
                  "text-[11px] rounded-lg border px-2 py-1 " +
                  (ativos.includes(f.id) ? "border-primary bg-primary/20 font-semibold" : "border-border/40 text-muted-foreground")
                }
              >
                {f.nomeTribunal}
              </button>
            ))}
            <button type="button" className="text-[10px] uppercase font-black text-muted-foreground px-2" onClick={() => setAtivos(filtrosDefaultOn())}>
              padrão
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Quantos (alvo)</span>
              <Input className="h-9 w-20 font-bold" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Dias</span>
              <Input className="h-9 w-16" value={dias} onChange={(e) => setDias(e.target.value)} />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Tribunal</span>
              <Input className="h-9 w-24 uppercase" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
            </label>
            {!busy ? (
              <Button onClick={iniciarScan} className="h-9 gap-2 text-xs font-black uppercase">
                <Search className="w-4 h-4" />
                Buscar até o alvo
              </Button>
            ) : (
              <Button onClick={parar} variant="destructive" className="h-9 gap-2 text-xs font-black uppercase">
                <Square className="w-3.5 h-3.5" />
                Parar
              </Button>
            )}
            <Button variant="secondary" onClick={baixar} disabled={!filtrados.length || exp} className="h-9 gap-2 text-xs font-black uppercase">
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              XLSX
            </Button>
            <Input className="h-9 flex-1 min-w-[140px]" placeholder="Filtrar lista…" value={qLocal} onChange={(e) => setQLocal(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
            <span className="text-foreground font-bold">{lista.length}/{alvo || "?"} ok</span>
            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {comTel} com tel. no teor</span>
            {busy && <span className="text-amber-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> scaneando…</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_320px] overflow-hidden">
          {/* lista */}
          <div className="overflow-auto p-3 space-y-2">
            {!filtrados.length && !busy && (
              <p className="text-sm text-muted-foreground text-center py-16 border border-dashed rounded-xl">
                Defina o alvo (ex. 60), marque filtros e clique em <strong>Buscar até o alvo</strong>.
              </p>
            )}
            {filtrados.map((p) => (
              <article key={p.processo} className="rounded-xl border border-border/50 bg-card/40 p-3 hover:border-primary/30">
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
                    {p.telefone ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.telefone}
                        <span className="text-[9px] text-muted-foreground uppercase">teor DJEN</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">Sem telefone na publicação pública</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">{p.classe || "—"}{p.situacao_hint ? ` · ${p.situacao_hint}` : ""}</p>
                  </div>
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-primary border border-primary/30 rounded-lg px-3 py-2 h-fit inline-flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> DJEN
                    </a>
                  )}
                </div>
                {p.assunto_ou_teor && (
                  <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 border-t border-border/30 pt-2">{p.assunto_ou_teor}</p>
                )}
              </article>
            ))}
          </div>

          {/* logs */}
          <aside className="border-t md:border-t-0 md:border-l border-border/50 flex flex-col min-h-[200px] max-h-[40vh] md:max-h-none overflow-hidden bg-black/20">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40">
              Log do scan
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-1">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "err" ? "text-red-400" :
                    l.level === "warn" ? "text-amber-400" :
                    l.level === "ok" ? "text-emerald-400" :
                    l.level === "skip" ? "text-muted-foreground" :
                    "text-slate-300"
                  }
                >
                  {l.ts && <span className="opacity-50">{l.ts} </span>}
                  {l.text}
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
