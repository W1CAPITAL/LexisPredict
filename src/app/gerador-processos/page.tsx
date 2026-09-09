"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrichmentConfigAction, scanDjenPaginaAction } from "@/app/actions/gerador-djen-action";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
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
import { Download, Loader2, Search, ExternalLink, Copy, Check, Square, Phone, Mail } from "lucide-react";

const MAX_PAG_POR_QUERY = 25;
const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoInicioPadrao = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Janelas curtas (DJEN rejeita intervalo enorme com HTML) */
function janelasDoIntervalo(inicio: string, fim: string, diasJanela = 14): { dataInicio: string; dataFim: string }[] {
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return [];
  const out: { dataInicio: string; dataFim: string }[] = [];
  let cur = new Date(b);
  while (cur >= a) {
    const end = new Date(cur);
    const start = new Date(cur);
    start.setDate(start.getDate() - (diasJanela - 1));
    if (start < a) start.setTime(a.getTime());
    out.push({ dataInicio: ymd(start), dataFim: ymd(end) });
    cur = new Date(start);
    cur.setDate(cur.getDate() - 1);
  }
  return out;
}

function Chip({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        "text-[11px] rounded-lg border px-2.5 py-1.5 transition font-medium " +
        (on
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/60 bg-background/40 text-muted-foreground hover:border-border")
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
  const [dataInicio, setDataInicio] = useState(isoInicioPadrao);
  const [dataFim, setDataFim] = useState(isoHoje);
  const [statusOn, setStatusOn] = useState<FiltroStatusId[]>(() => filtrosDefaultStatus());
  const [materiaOn, setMateriaOn] = useState<FiltroMateriaId[]>(() => filtrosDefaultMateria());
  const [cnpj, setCnpj] = useState("");
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

  const pushLogs = (more: ScanLogLine[]) => setLogs((prev) => [...prev, ...more].slice(-500));

  const toggleStatus = (id: FiltroStatusId) => {
    setStatusOn((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const toggleMateria = (id: FiltroMateriaId) => {
    setMateriaOn((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const filtrados = useMemo(() => {
    const q = qLocal.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((p) =>
      [p.processo, p.nome_completo, p.telefone, p.email, p.cpf, p.cnpj, p.classe, p.status_detectado]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [lista, qLocal]);

  const iniciarScan = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!statusOn.length && !materiaOn.length) {
      pushLogs([{ ts: "", level: "err", text: "Marque Filtro 1 e/ou Filtro 2." }]);
      return;
    }
    if (!dataInicio || !dataFim || dataInicio > dataFim) {
      pushLogs([{ ts: "", level: "err", text: "Intervalo de datas inválido." }]);
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
        text: `Alvo ${target} · F1[${statusOn.join(",") || "—"}] · F2[${materiaOn.join(",") || "—"}] · ${dataInicio}→${dataFim}` +
          (cnpj.replace(/\D/g, "") ? ` · CNPJ ${cnpj.replace(/\D/g, "")}` : ""),
      },
    ]);

    const byCnj = new Map<string, ProcessoDjenReal>();
    const janelas = janelasDoIntervalo(dataInicio, dataFim, 14);
    if (!janelas.length) {
      pushLogs([{ ts: "", level: "err", text: "Não foi possível montar janelas de data." }]);
      setBusy(false);
      return;
    }

    // totalQueries descoberto na 1ª chamada
    let totalQueries = 1;

    outer: for (const janela of janelas) {
      if (stopRef.current || byCnj.size >= target) break;
      pushLogs([
        {
          ts: new Date().toISOString().slice(11, 19),
          level: "info",
          text: `— Janela ${janela.dataInicio} → ${janela.dataFim} · ${byCnj.size}/${target} —`,
        },
      ]);

      for (let qi = 0; qi < totalQueries; qi++) {
        if (stopRef.current || byCnj.size >= target) break outer;
        let pagina = 1;
        let vazias = 0;

        while (pagina <= MAX_PAG_POR_QUERY && byCnj.size < target && !stopRef.current) {
          let res = await scanDjenPaginaAction({
            statusFiltros: statusOn,
            materiaFiltros: materiaOn,
            queryIndex: qi,
            pagina,
            dataInicio: janela.dataInicio,
            dataFim: janela.dataFim,
            siglaTribunal: tribunal.trim() || undefined,
            excludeCnjs: [...byCnj.keys()],
            cnpj: cnpj.replace(/\D/g, "") || undefined,
          });
          if (res.totalQueries) totalQueries = res.totalQueries;
          pushLogs(res.logs || []);

          if (res.geoBlocked) break outer;

          let retries = 0;
          while (res.rateLimited && retries < 6 && !stopRef.current) {
            retries++;
            pushLogs([
              {
                ts: new Date().toISOString().slice(11, 19),
                level: "warn",
                text: `429 — espera ${2 + retries}s`,
              },
            ]);
            await new Promise((r) => setTimeout(r, (2 + retries) * 1000));
            res = await scanDjenPaginaAction({
              statusFiltros: statusOn,
              materiaFiltros: materiaOn,
              queryIndex: qi,
              pagina,
              dataInicio: janela.dataInicio,
              dataFim: janela.dataFim,
              siglaTribunal: tribunal.trim() || undefined,
              excludeCnjs: [...byCnj.keys()],
              cnpj: cnpj.replace(/\D/g, "") || undefined,
            });
            pushLogs(res.logs || []);
          }

          // HTML/erro: não conta como progresso, tenta próxima query
          if (!res.success && !res.rateLimited) {
            break;
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
                text: `Progresso ${byCnj.size}/${target} (+${added})`,
              },
            ]);
            vazias = 0;
          } else {
            vazias++;
          }

          if (res.bruto === 0 || vazias >= 3) break;
          if (!res.hasMore && res.bruto < 80) break;
          pagina += 1;
          await new Promise((r) => setTimeout(r, 180));
        }
      }
    }

    setLista([...byCnj.values()]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: byCnj.size >= target ? "ok" : "warn",
        text: stopRef.current
          ? `Parado · ${byCnj.size}`
          : `Fim · ${byCnj.size}/${target}`,
      },
    ]);
    setBusy(false);
  };

  const baixar = async () => {
    if (!filtrados.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(filtrados as any);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-${filtrados.length}.xlsx`;
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
    } catch {
      /* */
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 border-b border-border/50 space-y-3 shrink-0 overflow-y-auto max-h-[55vh]">
          <div>
            <h1 className="text-xl font-black tracking-tight">DJEN revisional</h1>
            <p className="text-xs text-muted-foreground">
              <strong>Filtro 1</strong> = situação (extinto / ativo / encerrado).{" "}
              <strong>Filtro 2</strong> = matéria (revisional, classe…). Os dois se combinam (E).
              Chip <span className="text-primary font-bold">verde/preenchido</span> = ativo.
            </p>
          </div>

          {/* Filtro 1 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Filtro 1 · Situação do processo
              </p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {statusOn.length ? `${statusOn.length} ativo(s)` : "nenhum"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_STATUS.map((f) => (
                <Chip
                  key={f.id}
                  on={statusOn.includes(f.id as FiltroStatusId)}
                  label={f.nomeTribunal}
                  onClick={() => toggleStatus(f.id as FiltroStatusId)}
                />
              ))}
            </div>
          </div>

          {/* Filtro 2 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">
                Filtro 2 · Matéria / classe
              </p>
              <span className="text-[10px] font-mono text-muted-foreground">
                {materiaOn.length ? `${materiaOn.length} ativo(s)` : "nenhum"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTROS_MATERIA.map((f) => (
                <Chip
                  key={f.id}
                  on={materiaOn.includes(f.id as FiltroMateriaId)}
                  label={f.nomeTribunal}
                  onClick={() => toggleMateria(f.id as FiltroMateriaId)}
                />
              ))}
              <button
                type="button"
                className="text-[10px] uppercase font-black text-muted-foreground px-2"
                onClick={() => {
                  setStatusOn(filtrosDefaultStatus());
                  setMateriaOn(filtrosDefaultMateria());
                }}
              >
                padrão
              </button>
            </div>
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
              <span className="text-[9px] font-black uppercase text-muted-foreground">De</span>
              <Input
                className="h-9 w-36"
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">Até</span>
              <Input
                className="h-9 w-36"
                type="date"
                value={dataFim}
                min={dataInicio}
                max={isoHoje()}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground">CNPJ (opcional)</span>
              <Input
                className="h-9 w-40 font-mono"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </label>
            {!busy ? (
              <Button onClick={iniciarScan} className="h-9 gap-2 text-xs font-black uppercase">
                <Search className="w-4 h-4" /> Buscar até o alvo
              </Button>
            ) : (
              <Button
                onClick={() => {
                  stopRef.current = true;
                }}
                variant="destructive"
                className="h-9 gap-2 text-xs font-black uppercase"
              >
                <Square className="w-3.5 h-3.5" /> Parar
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={baixar}
              disabled={!filtrados.length || exp}
              className="h-9 gap-2 text-xs font-black uppercase"
            >
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} XLSX
            </Button>
            <Input
              className="h-9 flex-1 min-w-[140px]"
              placeholder="Filtrar lista (nome, CNJ, CNPJ…)"
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
            />
          </div>

          <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap gap-3">
            <span className="text-foreground font-bold">
              {lista.length}/{alvo}
            </span>
            {busy && (
              <span className="text-amber-500 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> scan…
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_300px] overflow-hidden">
          <div className="overflow-auto p-3 space-y-2">
            {!filtrados.length && !busy && (
              <p className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
                Ex.: F1 = <strong>Extinto sem resolução do mérito</strong> + F2 = <strong>Revisional</strong>.
                Só entram publicações que batem nos <em>dois</em>.
              </p>
            )}
            {filtrados.map((p) => (
              <article key={p.processo} className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="font-mono text-sm font-bold inline-flex items-center gap-1"
                        onClick={() => copy(p.processo)}
                      >
                        {p.processo}
                        {copied === p.processo ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </button>
                      <span className="text-[10px] font-black uppercase bg-secondary px-1.5 py-0.5 rounded">
                        {p.tribunal || "—"}
                      </span>
                      {p.status_detectado && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {p.status_detectado.replace(/_/g, " ")}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">{p.data}</span>
                    </div>
                    <p className="text-sm font-semibold">{p.nome_completo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.classe || "—"}
                      {p.situacao_hint ? ` · ${p.situacao_hint}` : ""}
                    </p>
                    {p.telefone && (
                      <p className="text-xs font-mono text-emerald-600">
                        <Phone className="w-3 h-3 inline" /> {p.telefone}
                      </p>
                    )}
                    {p.email && (
                      <p className="text-xs font-mono">
                        <Mail className="w-3 h-3 inline" /> {p.email}
                      </p>
                    )}
                  </div>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold uppercase text-primary border border-primary/30 rounded-lg px-3 py-2 h-fit inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> DJEN
                    </a>
                  )}
                </div>
                {p.assunto_ou_teor && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 border-t border-border/30 pt-2">
                    {p.assunto_ou_teor}
                  </p>
                )}
              </article>
            ))}
          </div>
          <aside className="border-t md:border-t-0 md:border-l border-border/50 flex flex-col overflow-hidden bg-black/20">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40">
              Log
            </div>
            <div className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-1">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "err"
                      ? "text-red-400"
                      : l.level === "warn"
                        ? "text-amber-400"
                        : l.level === "ok"
                          ? "text-emerald-400"
                          : "text-slate-300"
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
