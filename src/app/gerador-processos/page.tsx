"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanDjenPaginaAction, scanAleatorioDjenAction, scanCarteiraDjenAction } from "@/app/actions/gerador-djen-action";
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
import { SherlockPanel } from "@/components/sherlock-panel";

const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoIni = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

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
  const [modo, setModo] = useState<"carteira" | "aleatorio" | "texto">("carteira");
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [sherlockReady, setSherlockReady] = useState(false);
  const [sherlockBusy, setSherlockBusy] = useState<string | null>(null);
  const [sherlockHits, setSherlockHits] = useState<Record<string, { site: string; url: string; username?: string }[]>>({});
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

  const pushLogs = (m: ScanLogLine[]) => setLogs((p) => [...p, ...m].slice(-600));

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
        text: `Alvo ${target} · ${modo} · ${tribunal} · intervalo ${dataInicio} até ${dataFim}`,
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

    if (modo === "carteira") {
      let offset = 0;
      while (by.size < target && !stopRef.current) {
        const res = await scanCarteiraDjenAction({
          statusFiltros: statusOn,
          materiaFiltros: materiaOn,
          dataInicio,
          dataFim,
          siglaTribunal: tribunal || undefined,
          excludeCnjs: [...by.keys()],
          cnpj: cnpj.replace(/\D/g, "") || undefined,
          limit: 1,
          offset,
        });
        pushLogs(res.logs || []);
        add(res.items || []);
        if (!res.success || res.geoBlocked || res.rateLimited || !res.hasMore) break;
        offset += 1;
      }
    } else if (modo === "texto") {
      for (let qi = 0; qi < 8 && by.size < target && !stopRef.current; qi++) {
        const res = await scanDjenPaginaAction({
          statusFiltros: statusOn,
          materiaFiltros: materiaOn,
          queryIndex: qi,
          pagina: 1,
          dataInicio,
          dataFim,
          siglaTribunal: tribunal || undefined,
          excludeCnjs: [...by.keys()],
          cnpj: cnpj.replace(/\D/g, "") || undefined,
        });
        pushLogs(res.logs || []);
        if (res.htmlBlocked || res.geoBlocked) {
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "warn",
              text: "Texto bloqueado pelo WAF — use o modo Aleatório (CNJ sorteado).",
            },
          ]);
          break;
        }
        if (res.items?.length) add(res.items);
      }
    }

    if (modo === "aleatorio") {
      let wait429 = 8000;
      for (let i = 0; i < 80 && by.size < target && !stopRef.current; i++) {
      const res = await scanAleatorioDjenAction({
        statusFiltros: statusOn,
        materiaFiltros: materiaOn,
        dataInicio,
        dataFim,
        siglaTribunal: tribunal || undefined,
        excludeCnjs: [...by.keys()],
        cnpj: cnpj.replace(/\D/g, "") || undefined,
        lote: 8,
      });
      pushLogs(res.logs || []);
      if (res.geoBlocked) break;
      if (res.rateLimited) {
        pushLogs([
          {
            ts: new Date().toISOString().slice(11, 19),
            level: "warn",
            text: `429 · espera ${Math.round(wait429 / 1000)}s e segue no sorteio`,
          },
        ]);
        await new Promise((r) => setTimeout(r, wait429));
        wait429 = Math.min(wait429 + 4000, 25000);
        continue;
      }
      wait429 = 8000;
      if (res.items?.length) {
        const n = add(res.items);
        if (n)
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "ok",
              text: `${by.size}/${target}  (+${n} fora da carteira)`,
            },
          ]);
      }
      }
    }

    setLista([...by.values()]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: by.size ? "ok" : "warn",
        text: `Fim · ${by.size}/${target} · origem: ${modo === "carteira" ? "carteira consultada por CNJ" : modo === "aleatorio" ? "CNJ sorteado" : "consulta textual DJEN"}`,
      },
    ]);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 border-b space-y-3 shrink-0 overflow-y-auto max-h-[48vh]">
          <h1 className="text-xl font-black">Gerador de processos automáticos</h1>
          <p className="text-xs text-muted-foreground">
            Consulta processos reais no DJEN dentro do intervalo selecionado. No modo Carteira, lê cada registro salvo da sua empresa, um por vez, e consulta o CNJ correspondente. Não há dados fictícios nem garantia de preencher o alvo.
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
            <Input className="h-9 w-36" type="month" value={dataInicio.slice(0, 7)} max={isoHoje().slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, m] = v.split("-").map(Number);
                setDataInicio(`${v}-01`);
                const last = ymd(new Date(y, m, 0));
                setDataFim(last > isoHoje() ? isoHoje() : last);
              }}
            />
            <Input className="h-9 w-36 font-mono" placeholder="CNPJ opcional" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            <select className="h-9 border rounded-md px-2 text-xs bg-background" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
              <option value="carteira">Carteira · DJEN por CNJ (recomendado)</option>
              <option value="aleatorio">Aleatório · CNJ sorteado (experimental)</option>
              <option value="texto">Só texto DJEN (pode ser bloqueado)</option>
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
          </div>
          <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
            <SherlockPanel compact />
          </section>
          <p className="text-[11px] font-mono font-bold">
            {lista.length}/{alvo} {busy && <Loader2 className="w-3 h-3 inline animate-spin" />}
          </p>
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_minmax(280px,38%)] overflow-hidden">
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
          <aside className="border-l flex flex-col min-h-0 bg-[#0C0C0C] text-[#CCCCCC]">
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#6A9955] border-b border-[#222] shrink-0">
              C:\LEXIS\GERADOR&gt; log
            </div>
            <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-5">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "err"
                      ? "text-[#F14C4C]"
                      : l.level === "warn"
                        ? "text-[#CCA700]"
                        : l.level === "ok"
                          ? "text-[#3FC56A]"
                          : "text-[#D4D4D4]"
                  }
                >
                  <span className="text-[#6A9955]">{l.ts ? `${l.ts} ` : ""}</span>
                  {l.text}
                </div>
              ))}
              <div ref={logEnd} className="text-[#3FC56A]">{busy ? "_" : ""}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
