"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { djenBuscaTexto, cnjOficial, djenLink, type DjenItemRaw } from "@/lib/djen-client";
import { xlsxProcessosDjenReal } from "@/lib/xlsx-lista-cnj";
import {
  FILTROS_STATUS,
  FILTROS_MATERIA,
  filtrosDefaultStatus,
  filtrosDefaultMateria,
  passaFiltrosCombinados,
  textoTemCnpj,
  extractTelefoneSeguro,
  extractNomeCompletoFromDjen,
  formatCnjMasked,
  isSegredoOuSigilo,
  teorConsultavel,
  classificarSentenca,
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

/** Queries textuais derivadas dos chips F1/F2 marcados. */
function queriesDosFiltros(status: FiltroStatusId[], materia: FiltroMateriaId[]): string[] {
  const qs: string[] = [];
  if (status.includes("extinto_sem_merito")) qs.push("sem resolução do mérito", "art. 485");
  if (status.includes("extinto_com_merito")) qs.push("com resolução do mérito", "art. 487");
  if (status.includes("encerrado")) qs.push("arquivamento");
  if (status.includes("ativo")) qs.push("intime-se");
  for (const m of materia) {
    const f = FILTROS_MATERIA.find((x) => x.id === m);
    if (f?.djenQuery) qs.push(f.djenQuery);
  }
  if (status.includes("extinto_sem_merito") && materia.includes("acao_revisional")) {
    qs.unshift("485 revisional");
  }
  return [...new Set(qs)].slice(0, 10);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const agora = () => new Date().toISOString().slice(11, 19);

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
  const pushLog = (level: ScanLogLine["level"], text: string) =>
    pushLogs([{ ts: agora(), level, text }]);

  const iniciar = async () => {
    const target = Math.min(Math.max(parseInt(alvo, 10) || 60, 1), 500);
    if (!statusOn.length && !materiaOn.length) {
      pushLog("err", "Marque F1 e/ou F2");
      return;
    }
    stopRef.current = false;
    setBusy(true);
    setLista([]);
    setLogs([]);
    pushLog(
      "info",
      `Alvo ${target} · enrich OFF · sem sigilo · ${tribunal} · ${dataInicio} até ${dataFim}`
    );
    pushLog(
      "info",
      "Consulta DIRETA do seu navegador ao DJEN (Comunica PJe) — usa o IP da sua rede, não o do servidor. F1/F2 aplicados aqui, na tela."
    );

    const by = new Map<string, ProcessoDjenReal>();
    const exclude = new Set<string>();
    const cnpjDigits = cnpj.replace(/\D/g, "");
    const sigla = tribunal.trim().toUpperCase() || undefined;
    const queries = queriesDosFiltros(statusOn, materiaOn);

    const add = (items: ProcessoDjenReal[]) => {
      let n = 0;
      for (const it of items) {
        const d = it.processo.replace(/\D/g, "");
        if (by.has(d)) continue;
        by.set(d, it);
        exclude.add(d);
        n++;
        if (by.size >= target) break;
      }
      if (n) setLista([...by.values()]);
      return n;
    };

    try {
      outer: for (const q of queries) {
        if (by.size >= target || stopRef.current) break;

        let pagina = 1;
        let paginasVazias = 0;

        while (pagina <= 25 && by.size < target && !stopRef.current) {
          pushLog("info", `Texto “${q}” · pág ${pagina} · ${dataInicio}→${dataFim}`);
          let res = await djenBuscaTexto({
            texto: q,
            dataInicio,
            dataFim,
            pagina,
            itensPorPagina: 50,
            siglaTribunal: sigla,
          });

          // 429 → espera crescente e repete a MESMA página (até 6x)
          let retries = 0;
          while (res.rateLimited && retries < 6 && !stopRef.current) {
            retries++;
            const espera = 3 * retries;
            pushLog("warn", `429 — espera ${espera}s e repete pág ${pagina}`);
            await sleep(espera * 1000);
            res = await djenBuscaTexto({
              texto: q,
              dataInicio,
              dataFim,
              pagina,
              itensPorPagina: 50,
              siglaTribunal: sigla,
            });
          }

          // WAF/HTML → espera longa e repete a MESMA página (até 3x)
          let wafTries = 0;
          while (res.htmlBlocked && wafTries < 3 && !stopRef.current) {
            wafTries++;
            pushLog("warn", `Bloqueio WAF — espera 20s e repete pág ${pagina} (${wafTries}/3)`);
            await sleep(20000);
            res = await djenBuscaTexto({
              texto: q,
              dataInicio,
              dataFim,
              pagina,
              itensPorPagina: 50,
              siglaTribunal: sigla,
            });
          }
          if (res.htmlBlocked) {
            pushLog("err", "DJEN segue bloqueando após 3 esperas — tente mais tarde (o bloqueio expira sozinho).");
            break outer;
          }
          if (res.geoBlocked) {
            pushLog("err", "DJEN 403 para a sua rede — raro; tente novamente mais tarde.");
            break outer;
          }
          if (!res.ok) {
            pushLog("err", String(res.error || "falha na consulta"));
            break;
          }

          // ---- filtros F1/F2 e higiene, localmente ----
          const bruto = res.items.length;
          const rows: ProcessoDjenReal[] = [];
          let skipSigilo = 0,
            skipCnj = 0,
            skipDup = 0,
            skipTeor = 0,
            skipCnpj = 0,
            skipFiltro = 0,
            skipNome = 0;

          for (const it of res.items) {
            const blob = `${it.nomeClasse || ""} ${it.texto || ""}`;
            if (isSegredoOuSigilo(blob)) {
              skipSigilo++;
              continue;
            }
            const digits = cnjOficial(it); // SEMPRE o campo oficial da API
            if (!digits) {
              skipCnj++;
              continue;
            }
            if (exclude.has(digits)) {
              skipDup++;
              continue;
            }
            if (!teorConsultavel(it.texto)) {
              skipTeor++;
              continue;
            }
            if (cnpjDigits && !textoTemCnpj(blob, cnpjDigits)) {
              skipCnpj++;
              continue;
            }
            const gate = passaFiltrosCombinados(blob, statusOn, materiaOn);
            if (!gate.ok) {
              skipFiltro++;
              continue;
            }
            const nome =
              extractNomeCompletoFromDjen({
                texto: it.texto,
                destinatarios: (it as any).destinatarios,
              }) || "";
            if (!nome) {
              skipNome++;
              continue;
            }
            rows.push(toRow(it, digits, gate, nome, sigla));
          }

          pushLog(
            rows.length ? "ok" : "warn",
            `Pág ${pagina}: aceitos ${rows.length}/${bruto} · filtro_F1F2:${skipFiltro} sem_nome:${skipNome} sigilo:${skipSigilo} teor:${skipTeor} dup:${skipDup} sem_num:${skipCnj}`
          );

          const added = add(rows);
          if (added) pushLog("ok", `Progresso ${by.size}/${target} (+${added})`);

          if (bruto === 0) {
            paginasVazias++;
            if (paginasVazias >= 2) break;
          } else paginasVazias = 0;

          if (bruto < 50) break; // última página desta query
          pagina += 1;
          await sleep(1200); // ritmo de leitura — sem rajada
        }
        if (by.size >= target || stopRef.current) break outer;
      }
    } catch (e: any) {
      pushLog("err", `Erro inesperado: ${e?.message || String(e)}`);
    }

    setLista([...by.values()]);
    pushLog(
      by.size ? "ok" : "warn",
      `Fim · ${by.size}/${target} · consulta direta navegador→DJEN (número oficial da API, sem CNJ de teor, sem filtro de carteira/nome na consulta)`
    );
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
      pushLog("err", `XLSX: ${e?.message || e}`);
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
            Consulta publicações reais no DJEN (Comunica PJe) direto do seu navegador — sem servidor intermediário.
            O número exibido é sempre o campo oficial da API (nunca extraído do teor). Sem dados fictícios, sem enriquecimento externo.
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

// ---------- row builder ----------

function toRow(it: DjenItemRaw, digits: string, gate: any, nome: string, sigla?: string): ProcessoDjenReal {
  const tel = extractTelefoneSeguro(it.texto || "");
  const statusLabel =
    FILTROS_STATUS.find((f) => f.id === gate.status)?.nomeTribunal || gate.status || "";
  const matLabel = (gate.materiaHits || [])
    .map((id: string) => FILTROS_MATERIA.find((f) => f.id === id)?.nomeTribunal)
    .filter(Boolean)
    .join(" · ");
  const decisao = classificarSentenca(String(it.texto || ""));
  const decisaoLabel = {
    extinto_sem_merito: "Extinto sem resolução do mérito",
    extinto_com_merito: "Extinto com resolução do mérito",
    procedente: "Sentença procedente",
    improcedente: "Sentença improcedente",
    procedente_parcial: "Sentença procedente em parte",
    nao_classificada: "Sentença não classificada",
  }[decisao];
  return {
    processo: formatCnjMasked(digits),
    nome_completo: nome,
    telefone: tel,
    email: "",
    cpf: "",
    cnpj: "",
    endereco: "",
    cep: "",
    bairro: "",
    municipio: "",
    uf: "",
    situacao_cadastral: "",
    telefone_fonte: tel ? "teor_djen_publico" : "",
    enrich_fonte: "",
    classe: String(it.nomeClasse || "").trim(),
    assunto_ou_teor: String(it.texto || "").replace(/\s+/g, " ").trim().slice(0, 240),
    situacao_hint: [statusLabel, matLabel, decisaoLabel].filter(Boolean).join(" · "),
    status_detectado: gate.status || decisao,
    tribunal: String(it.siglaTribunal || sigla || "").toUpperCase(),
    data: String(it.data_disponibilizacao || "").slice(0, 10),
    link: djenLink(it, digits),
    filtros: [gate.status, ...(gate.materiaHits || [])].filter(Boolean).join("|"),
    consultavel: true,
  };
}
