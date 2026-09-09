"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanDjenPaginaAction, scanCarteiraDjenAction } from "@/app/actions/gerador-djen-action";
import { sherlockBuscarPorNomeAction, sherlockStatusAction } from "@/app/actions/sherlock-action";
import {
  FILTROS_STATUS,
  FILTROS_MATERIA,
  filtrosDefaultStatus,
  filtrosDefaultMateria,
  type FiltroStatusId,
  type FiltroMateriaId,
  type ProcessoDjenReal,
  type ScanLogLine,
} from "@/lib/revisional-tribunal-filtros";
import { Download, Loader2, Search, ExternalLink, Square } from "lucide-react";

const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoIni = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function janelas(inicio: string, fim: string, n = 14) {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return [];
  const out: { dataInicio: string; dataFim: string }[] = [];
  let cur = new Date(b);
  while (cur >= a) {
    const end = new Date(cur);
    const start = new Date(cur);
    start.setDate(start.getDate() - (n - 1));
    if (start < a) start.setTime(a.getTime());
    out.push({ dataInicio: ymd(start), dataFim: ymd(end) });
    cur = new Date(start);
    cur.setDate(cur.getDate() - 1);
  }
  return out;
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        "text-[11px] rounded-lg border px-2.5 py-1.5 font-medium " +
        (on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground")
      }
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}

export default function GeradorProcessosPage() {
  const [alvo, setAlvo] = useState("60");
  const [tribunal, setTribunal] = useState("TJSP");
  const [dataInicio, setDataInicio] = useState(isoIni);
  const [dataFim, setDataFim] = useState(isoHoje);
  const [statusOn, setStatusOn] = useState<FiltroStatusId[]>(() => filtrosDefaultStatus());
  const [materiaOn, setMateriaOn] = useState<FiltroMateriaId[]>(() => filtrosDefaultMateria());
  const [cnpj, setCnpj] = useState("");
  const [modo, setModo] = useState<"auto" | "carteira" | "texto">("auto");
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [sherlockReady, setSherlockReady] = useState(false);
  const [sherlockBusy, setSherlockBusy] = useState<string | null>(null);
  const [sherlockHits, setSherlockHits] = useState<Record<string, { site: string; url: string; username: string }[]>>({});
  const stopRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  useEffect(() => {
    sherlockStatusAction()
      .then((s) => setSherlockReady(!!s.ready))
      .catch(() => null);
  }, []);

  const pushLogs = (m: ScanLogLine[]) => setLogs((p) => [...p, ...m].slice(-500));

  const iniciar = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!statusOn.length && !materiaOn.length) {
      pushLogs([{ ts: "", level: "err", text: "Marque F1 e/ou F2" }]);
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
        text: `Alvo ${target} · modo ${modo} · F1[${statusOn}] · F2[${materiaOn}]`,
      },
    ]);

    const by = new Map<string, ProcessoDjenReal>();
    const add = (items: ProcessoDjenReal[]) => {
      let n = 0;
      for (const it of items) {
        const d = it.processo.replace(/\D/g, "");
        if (by.has(d)) continue;
        by.set(d, it);
        n++;
        if (by.size >= target) break;
      }
      if (n) setLista([...by.values()]);
      return n;
    };

    let textoFalhou = false;
    if (modo !== "carteira") {
      let tq = 1;
      outer: for (const j of janelas(dataInicio, dataFim, 14)) {
        if (stopRef.current || by.size >= target) break;
        for (let qi = 0; qi < tq; qi++) {
          if (stopRef.current || by.size >= target) break outer;
          let html = 0;
          for (let pagina = 1; pagina <= 6 && by.size < target && !stopRef.current; pagina++) {
            const res = await scanDjenPaginaAction({
              statusFiltros: statusOn,
              materiaFiltros: materiaOn,
              queryIndex: qi,
              pagina,
              dataInicio: j.dataInicio,
              dataFim: j.dataFim,
              siglaTribunal: tribunal || undefined,
              excludeCnjs: [...by.keys()],
              cnpj: cnpj.replace(/\D/g, "") || undefined,
            });
            if (res.totalQueries) tq = res.totalQueries;
            pushLogs(res.logs || []);
            if (res.geoBlocked) break outer;
            if (res.htmlBlocked) {
              html++;
              textoFalhou = true;
              if (html >= 2) break;
            }
            if (res.rateLimited) {
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            if (res.success && res.items?.length) {
              const n = add(res.items);
              if (n)
                pushLogs([
                  {
                    ts: new Date().toISOString().slice(11, 19),
                    level: "ok",
                    text: `${by.size}/${target} (+${n} texto)`,
                  },
                ]);
            }
            if (!res.success || res.bruto < 40) break;
          }
        }
      }
    }

    if ((modo === "auto" && textoFalhou) || modo === "carteira" || (modo === "auto" && by.size < target)) {
      if (textoFalhou)
        pushLogs([
          {
            ts: new Date().toISOString().slice(11, 19),
            level: "warn",
            text: "Texto WAF → fallback carteira (igual scanner 09ebace/parados)",
          },
        ]);
      let offset = 0;
      for (let i = 0; i < 40 && by.size < target && !stopRef.current; i++) {
        const res = await scanCarteiraDjenAction({
          statusFiltros: statusOn,
          materiaFiltros: materiaOn,
          dataInicio,
          dataFim,
          siglaTribunal: tribunal || undefined,
          excludeCnjs: [...by.keys()],
          cnpj: cnpj.replace(/\D/g, "") || undefined,
          limit: 25,
          offset,
        });
        pushLogs(res.logs || []);
        if (res.geoBlocked) break;
        if (res.rateLimited) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        if (res.items?.length) {
          const n = add(res.items);
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "ok",
              text: `${by.size}/${target} (+${n} carteira/CNJ)`,
            },
          ]);
        }
        offset += res.scanned || 25;
        if (!res.hasMore) break;
      }
    }

    setLista([...by.values()]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: by.size ? "ok" : "warn",
        text: `Fim · ${by.size}/${target}`,
      },
    ]);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 border-b space-y-3 shrink-0 overflow-y-auto max-h-[55vh]">
          <h1 className="text-xl font-black">DJEN revisional</h1>
          <p className="text-xs text-muted-foreground">
            Modo <b>Auto</b>: texto → se WAF, <b>carteira + DJEN por CNJ</b> (scanner que funciona). Sherlock = perfis
            públicos grátis (self-host).
          </p>
          <div>
            <p className="text-[10px] font-black uppercase text-amber-600">Filtro 1 · Situação · {statusOn.length}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTROS_STATUS.map((f) => (
                <Chip
                  key={f.id}
                  on={statusOn.includes(f.id as FiltroStatusId)}
                  label={f.nomeTribunal}
                  onClick={() =>
                    setStatusOn((p) =>
                      p.includes(f.id as FiltroStatusId) ? p.filter((x) => x !== f.id) : [...p, f.id as FiltroStatusId]
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-sky-600">Filtro 2 · Matéria · {materiaOn.length}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FILTROS_MATERIA.map((f) => (
                <Chip
                  key={f.id}
                  on={materiaOn.includes(f.id as FiltroMateriaId)}
                  label={f.nomeTribunal}
                  onClick={() =>
                    setMateriaOn((p) =>
                      p.includes(f.id as FiltroMateriaId)
                        ? p.filter((x) => x !== f.id)
                        : [...p, f.id as FiltroMateriaId]
                    )
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Input className="h-9 w-20" value={alvo} onChange={(e) => setAlvo(e.target.value)} title="Alvo" />
            <Input className="h-9 w-24 uppercase" value={tribunal} onChange={(e) => setTribunal(e.target.value)} />
            <Input className="h-9 w-36" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <Input className="h-9 w-36" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            <Input className="h-9 w-36 font-mono" placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            <select className="h-9 border rounded-md px-2 text-xs bg-background" value={modo} onChange={(e) => setModo(e.target.value as any)}>
              <option value="auto">Auto</option>
              <option value="carteira">Só carteira/CNJ</option>
              <option value="texto">Só texto</option>
            </select>
            {!busy ? (
              <Button onClick={iniciar} className="h-9 text-xs font-black uppercase gap-1">
                <Search className="w-4 h-4" /> Buscar
              </Button>
            ) : (
              <Button variant="destructive" className="h-9 text-xs font-black uppercase" onClick={() => (stopRef.current = true)}>
                <Square className="w-3 h-3" /> Parar
              </Button>
            )}
            <span className="text-[10px] font-mono">
              Sherlock: {sherlockReady ? "ON" : "off (env)"}
            </span>
          </div>
          <p className="text-[11px] font-mono font-bold">
            {lista.length}/{alvo} {busy && <Loader2 className="w-3 h-3 inline animate-spin" />}
          </p>
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_280px] overflow-hidden">
          <div className="overflow-auto p-3 space-y-2">
            {lista.map((p) => (
              <article key={p.processo} className="border rounded-xl p-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{p.processo}</p>
                    <p className="text-sm font-semibold">{p.nome_completo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.status_detectado} · {p.situacao_hint}
                    </p>
                    {sherlockHits[p.processo]?.map((h) => (
                      <a key={h.url} href={h.url} target="_blank" rel="noreferrer" className="block text-[10px] text-primary underline">
                        {h.site} @{h.username}
                      </a>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="text-[10px] font-black uppercase border rounded-lg px-2 py-1"
                      disabled={!!sherlockBusy}
                      onClick={async () => {
                        setSherlockBusy(p.processo);
                        const r = await sherlockBuscarPorNomeAction(p.nome_completo);
                        setSherlockHits((prev) => ({ ...prev, [p.processo]: r.hits || [] }));
                        pushLogs([
                          {
                            ts: new Date().toISOString().slice(11, 19),
                            level: r.ok ? "ok" : "warn",
                            text: `Sherlock ${p.nome_completo}: ${r.hits?.length || 0} · ${r.error || ""}`,
                          },
                        ]);
                        setSherlockBusy(null);
                      }}
                    >
                      Sherlock
                    </button>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary inline-flex gap-1 items-center">
                        <ExternalLink className="w-3 h-3" /> DJEN
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="border-l overflow-auto p-2 font-mono text-[10px] bg-black/20">
            {logs.map((l, i) => (
              <div key={i} className={l.level === "err" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : l.level === "ok" ? "text-emerald-400" : ""}>
                {l.ts} {l.text}
              </div>
            ))}
            <div ref={logEnd} />
          </aside>
        </div>
      </main>
    </div>
  );
}
