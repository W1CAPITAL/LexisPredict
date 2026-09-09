"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanDjenPaginaAction, enrichmentConfigAction } from "@/app/actions/gerador-djen-action";
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
import { Download, Loader2, Search, ExternalLink, Square } from "lucide-react";

const isoHoje = () => new Date().toISOString().slice(0, 10);
const isoIni = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

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
  const [lista, setLista] = useState<ProcessoDjenReal[]>([]);
  const [logs, setLogs] = useState<ScanLogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState(false);
  const stopRef = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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
        text: `Alvo ${target} · enrich OFF · sem sigilo · ${tribunal} · ${dataInicio} até ${dataFim}`,
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

    try {
      // UM fluxo: feed por data (+tribunal), paginando no ritmo do DJEN.
      // Sem rajada de queries textuais — era isso que ativava o bloqueio WAF.
      let pagina = 1;
      let falhasSeguidas = 0;

      while (by.size < target && !stopRef.current) {
        let res = await scanDjenPaginaAction({
          statusFiltros: statusOn,
          materiaFiltros: materiaOn,
          pagina,
          dataInicio,
          dataFim,
          siglaTribunal: tribunal.trim().toUpperCase() || undefined,
          excludeCnjs: [...by.keys()],
          cnpj: cnpj.replace(/\D/g, "") || undefined,
        });
        pushLogs(res.logs || []);

        // 429 → espera crescente e repete a MESMA página.
        let retries = 0;
        while (res.rateLimited && retries < 6 && !stopRef.current) {
          retries++;
          const espera = 3 * retries;
          pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "warn", text: `429 — espera ${espera}s e repete pág ${pagina}` }]);
          await new Promise((r) => setTimeout(r, espera * 1000));
          res = await scanDjenPaginaAction({
            statusFiltros: statusOn,
            materiaFiltros: materiaOn,
            pagina,
            dataInicio,
            dataFim,
            siglaTribunal: tribunal.trim().toUpperCase() || undefined,
            excludeCnjs: [...by.keys()],
            cnpj: cnpj.replace(/\D/g, "") || undefined,
          });
          pushLogs(res.logs || []);
        }

        // WAF/HTML → espera longa e repete a mesma página (até 3x), sem desistir na 1ª.
        if (res.htmlBlocked) {
          falhasSeguidas++;
          if (falhasSeguidas >= 3) {
            pushLogs([
              {
                ts: new Date().toISOString().slice(11, 19),
                level: "err",
                text: "DJEN segue bloqueando após 3 esperas — pare e tente mais tarde (o bloqueio expira sozinho).",
              },
            ]);
            break;
          }
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "warn",
              text: `Bloqueio WAF — espera 20s e repete pág ${pagina} (tentativa ${falhasSeguidas}/3)`,
            },
          ]
          );
          await new Promise((r) => setTimeout(r, 20000));
          continue;
        }
        falhasSeguidas = 0;

        if (res.geoBlocked) {
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "err",
              text: "DJEN geo-bloqueou este servidor (403). Nenhuma aba consegue consultar a partir desta região.",
            },
          ]);
          break;
        }
        if (!res.success) break;

        const added = add(res.items || []);
        if (added) {
          pushLogs([
            {
              ts: new Date().toISOString().slice(11, 19),
              level: "ok",
              text: `Progresso ${by.size}/${target} (+${added})`,
            },
          ]);
        }

        if (!res.hasMore || (res.bruto || 0) === 0) break;
        pagina += 1;
        // Pacing: 1 página a cada ~1,2s — ritimo de leitura, não de rajada.
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (e: any) {
      pushLogs([
        {
          ts: new Date().toISOString().slice(11, 19),
          level: "err",
          text: `Erro inesperado: ${e?.message || String(e)}`,
        },
      ]);
    }

    setLista([...by.values()]);
    pushLogs([
      {
        ts: new Date().toISOString().slice(11, 19),
        level: by.size ? "ok" : "warn",
        text: `Fim · ${by.size}/${target} · origem: feed DJEN por data + tribunal (número oficial da API, sem CNJ de teor, sem filtro de carteira/nome na consulta)`,
      },
    ]);
    setBusy(false);
  };

  const baixar = async () => {
    if (!lista.length) return;
    setExp(true);
    try {
      const blob = await xlsxProcessosDjenReal(lista);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `djen-processos-${lista.length}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      pushLogs([{ ts: new Date().toISOString().slice(11, 19), level: "err", text: `XLSX: ${e?.message || e}` }]);
    } finally {
      setExp(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col max-h-screen overflow-hidden">
        <div className="p-4 border-b space-y-3 shrink-0 overflow-y-auto max-h-[48vh]">
          <h1 className="text-xl font-black">Gerador de processos automáticos</h1>
          <p className="text-xs text-muted-foreground">
            Consulta publicações reais no DJEN dentro do intervalo. O número exibido é sempre o campo oficial da API
            (nunca extraído do teor). Sem dados fictícios, sem enriquecimento externo.
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
                      p.includes(f.id as FiltroMateriaId) ? p.filter((x) => x !== f.id) : [...p, f.id as FiltroMateriaId]
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
            <Input className="h-9 w-36 font-mono" placeholder="CNPJ opcional" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            {!busy ? (
              <Button onClick={iniciar} className="h-9 text-xs font-black uppercase gap-1">
                <Search className="w-4 h-4" /> Buscar
              </Button>
            ) : (
              <Button variant="destructive" className="h-9 text-xs font-black uppercase" onClick={() => (stopRef.current = true)}>
                <Square className="w-3 h-3" /> Parar
              </Button>
            )}
            <Button variant="secondary" onClick={baixar} disabled={!lista.length || exp} className="h-9 text-xs font-black uppercase gap-1">
              {exp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} XLSX
            </Button>
          </div>
          <p className="text-[11px] font-mono font-bold">
            {lista.length}/{alvo} {busy && <Loader2 className="w-3 h-3 inline animate-spin" />}
          </p>
        </div>
        <div className="flex-1 min-h-0 grid md:grid-cols-[1fr_minmax(280px,38%)] overflow-hidden">
          <div className="overflow-auto p-3 space-y-2">
            {lista.map((p) => {
              const blob = `${p.status_detectado} ${p.situacao_hint}`.toLowerCase();
              const extinto = blob.includes("extinto");
              const procedente = !extinto && (blob.includes("procedente") || blob.includes("procedente em parte"));
              const improcedente = !extinto && blob.includes("improcedente");
              return (
                <article key={p.processo} className="border rounded-xl p-3 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm font-bold">{p.processo}</p>
                        <span
                          className={
                            "text-[10px] font-black uppercase rounded-full px-2 py-0.5 border " +
                            (extinto
                              ? "bg-red-500/15 text-red-500 border-red-500/40"
                              : procedente
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40"
                                : improcedente
                                  ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
                                  : "bg-muted text-muted-foreground border-border")
                          }
                        >
                          {extinto ? "EXTINTO" : procedente ? "PROCEDENTE" : improcedente ? "IMPROCEDENTE" : "NÃO CLASSIFICADO"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{p.nome_completo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.classe || "—"} · {p.situacao_hint} · {p.data}
                      </p>
                      {p.telefone && (
                        <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{p.telefone}</p>
                      )}
                    </div>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-primary inline-flex gap-1 items-center"
                      >
                        <ExternalLink className="w-3 h-3" /> DJEN
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
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
