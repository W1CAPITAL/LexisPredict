"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, Download, FileSearch, Filter,
  LoaderCircle, RefreshCw, Search, ShieldCheck,
} from "lucide-react";
import {
  classifyFasesProvas, exportTriageRow, formatFasesDate, normalizePhaseText,
  sortTriageRows, TRIAGE_EXPORT_HEADERS,
  type TriageCategory, type TriageKind, type TriageRow,
} from "@/lib/fases-provas-triage";
import "./fases-provas.css";

const PAGE_SIZE = 400;
const MAX_ROWS = 10000;
const SHOW_STEP = 80;
type CaseRecord = Record<string, unknown>;
type SourceFilter = "todos" | "tribunal" | "cadastro" | "mencao";
type TypeFilter = "todos" | TriageKind;
type StateFilter = "todos" | TriageCategory;

function SourceBadge({ level }: { level: TriageRow["nivel"] }) {
  const text = level === "tribunal" ? "Último ato consultado" : level === "cadastro" ? "Registro interno" : "Apenas menção";
  return <span className={"fp-badge fp-badge-" + level}>{text}</span>;
}
function PriorityBadge({ value }: { value: TriageRow["prioridade"] }) {
  const label = value === "alta" ? "Ação prioritária" : value === "media" ? "Acompanhar" : "Baixa prioridade";
  return <span className={"fp-badge fp-badge-" + value}>{label}</span>;
}
function Evidence({ row }: { row: TriageRow }) {
  return <details className="fp-detail">
    <summary>Ver evidências completas</summary>
    <div className="mt-2 space-y-2 text-xs">
      <p className="fp-muted"><strong>Registro interno:</strong> {row.registroInterno || "Não encontrado"}</p>
      <p className="fp-muted"><strong>Último movimento DataJud:</strong> {row.datajudUltimoNome || "Não encontrado"}</p>
      <p className="fp-muted"><strong>Última publicação DJEN:</strong> {row.djenUltimoResumo || "Não encontrada"}</p>
      {row.linkDjen ? <a className="fp-link" href={row.linkDjen} target="_blank" rel="noopener noreferrer">Abrir publicação DJEN</a> : null}
    </div>
  </details>;
}
function ProcessLink({ row }: { row: TriageRow }) {
  return row.cnj
    ? <Link className="fp-link" href={"/processos?processo=" + encodeURIComponent(row.cnj)} title="Localizar na carteira">Abrir processo <ArrowRight className="inline h-3.5 w-3.5" /></Link>
    : <span className="fp-muted text-xs">Sem número CNJ</span>;
}
function ResultsTable({ items, label, busy, filterKey }: {items:TriageRow[];label:string;busy:boolean;filterKey:string}) {
  const [shown, setShown] = useState(SHOW_STEP);
  useEffect(() => setShown(SHOW_STEP), [filterKey]);
  const visible = items.slice(0, shown);
  return <div className="fp-card overflow-hidden rounded-2xl">
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
      <p className="text-sm font-bold">{label} · {items.length.toLocaleString("pt-BR")} ocorrência(s)</p>
      <span className="fp-muted text-xs">Exibindo {visible.length.toLocaleString("pt-BR")} de {items.length.toLocaleString("pt-BR")}</span>
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="fp-table">
        <thead><tr>
          <th style={{width:"17%"}}>Cliente e processo</th>
          <th style={{width:"23%"}}>Situação identificada</th>
          <th style={{width:"23%"}}>Evidência</th>
          <th style={{width:"25%"}}>Próxima ação</th>
          <th style={{width:"12%"}}>Responsável</th>
        </tr></thead>
        <tbody>
          {visible.map(row => <tr key={row.key}>
            <td><strong className="block font-semibold">{row.cliente}</strong><div className="fp-muted mt-1 break-all font-mono text-[11px]">{row.cnj || "CNJ não informado"}</div><div className="mt-3"><ProcessLink row={row}/></div></td>
            <td>
              <div className="flex flex-wrap gap-1.5"><SourceBadge level={row.nivel}/><PriorityBadge value={row.prioridade}/></div>
              <p className="mt-2 font-bold">{row.fase}</p><p className="fp-muted mt-1">{row.motivo}</p>
              <p className="fp-muted mt-2 text-[11px]">Carteira: {row.status}</p>
            </td>
            <td><p className="fp-muted mb-1 text-[11px] font-semibold">{row.fonte} · {row.dataMovimento}</p><div className="fp-evidence">{row.evidencia || "Sem trecho disponível"}</div><Evidence row={row}/></td>
            <td><p className="font-semibold">{row.acao}</p>
              <p className="fp-muted mt-2 text-[11px]">DataJud: {row.datajud} · DJEN: {row.djen}</p>
              {row.proximoRetorno ? <p className="fp-muted mt-1 text-[11px]">Retorno cadastrado (não é prazo judicial): {formatFasesDate(row.proximoRetorno)}</p> : null}
            </td>
            <td><strong className="block">{row.advogado}</strong><p className="fp-muted mt-1">{row.escritorio || row.tribunal || "Sem escritório"}</p></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="space-y-2 px-3 pb-3 md:hidden">
      {visible.map(row => <article key={row.key} className="fp-mobile-row space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2"><strong>{row.cliente}</strong><PriorityBadge value={row.prioridade}/></div>
        <p className="fp-muted break-all font-mono text-[11px]">{row.cnj || "CNJ não informado"}</p>
        <SourceBadge level={row.nivel}/>
        <p className="text-sm font-bold">{row.fase}</p>
        <p className="fp-muted text-xs">{row.motivo}</p>
        <p className="fp-evidence text-xs">{row.evidencia || "Sem trecho disponível"}</p>
        <p className="text-xs font-semibold">Próximo passo: {row.acao}</p>
        <p className="fp-muted text-xs">{row.advogado} · {row.fonte}</p>
        <Evidence row={row}/><ProcessLink row={row}/>
      </article>)}
    </div>
    {!items.length ? <div className="fp-muted px-5 py-10 text-center text-sm">{busy ? "Consultando os processos…" : "Nenhum resultado corresponde aos filtros."}</div> : null}
    {shown < items.length ? <div className="flex justify-center border-t px-4 py-4" style={{borderColor:"var(--fp-line)"}}>
      <button type="button" className="fp-button" onClick={() => setShown(n => n + SHOW_STEP)}>Mostrar mais {Math.min(SHOW_STEP,items.length-shown)} registros</button>
    </div> : null}
  </div>;
}

export default function FasesProvasClient() {
  const [data,setData] = useState<TriageRow[]>([]);
  const [rowsScanned,setRowsScanned] = useState(0);
  const [loadingInitial,setLoadingInitial] = useState(true);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,setHasMore] = useState(true);
  const [error,setError] = useState("");
  const [exportError,setExportError] = useState("");
  const [exporting,setExporting] = useState(false);
  const [retryToken,setRetryToken] = useState(0);
  const [query,setQuery] = useState("");
  const [tipo,setTipo] = useState<TypeFilter>("todos");
  const [source,setSource] = useState<SourceFilter>("todos");
  const [stage,setStage] = useState<StateFilter>("todos");
  const [priority,setPriority] = useState("todos");
  const [exportScope,setExportScope] = useState<"filtrados"|"todos">("filtrados");
  const nextOffset = useRef(0);
  const seenKeys = useRef(new Set<string>());
  const busy = loadingInitial || loadingMore;
  const capped = rowsScanned >= MAX_ROWS;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async () => {
      let offset = nextOffset.current;
      if (offset === 0) {
        setLoadingInitial(true);
        setData([]);
        setRowsScanned(0);
        seenKeys.current = new Set<string>();
      } else {
        setLoadingInitial(false);
        setLoadingMore(true);
      }
      setError("");
      try {
        while (active && offset < MAX_ROWS) {
          const res = await fetch("/api/carteira/fast?scope=empresa&limit=" + PAGE_SIZE + "&offset=" + offset + "&summary=0", {
            method:"GET", cache:"no-store", signal:controller.signal, headers:{Accept:"application/json"},
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok || payload?.ok !== true || !Array.isArray(payload?.cases)) {
            throw new Error(String(payload?.error || "Não foi possível acessar a carteira."));
          }
          if (!active) return;
          const cases = payload.cases as CaseRecord[];
          const classified = classifyFasesProvas(cases,seenKeys.current);
          setData(previous => offset === 0 ? classified : [...previous,...classified]);
          offset += cases.length;
          nextOffset.current = offset;
          setRowsScanned(offset);
          const more = cases.length === PAGE_SIZE && offset < MAX_ROWS;
          setHasMore(more);
          setLoadingInitial(false);
          if (!more) break;
          setLoadingMore(true);
          // A lista já se torna utilizável após o primeiro lote.
          await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        }
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Consulta interrompida.");
          setHasMore(true);
        }
      } finally {
        if (active) { setLoadingInitial(false);setLoadingMore(false); }
      }
    };
    void load();
    return () => { active = false;controller.abort(); };
  }, [retryToken]);

  const refresh = () => {
    nextOffset.current = 0;
    seenKeys.current = new Set<string>();
    setRetryToken(v => v+1);
  };
  const allRows = useMemo(() => sortTriageRows(data), [data]);
  const filtered = useMemo(() => allRows.filter(row => {
    if (tipo !== "todos" && row.tipo !== tipo) return false;
    if (source !== "todos" && row.nivel !== source) return false;
    if (stage !== "todos" && row.categoria !== stage) return false;
    if (priority !== "todos" && row.prioridade !== priority) return false;
    if (!query.trim()) return true;
    const text = normalizePhaseText([row.cliente,row.cnj,row.advogado,row.fase,row.acao,row.evidencia,row.escritorio].join(" "));
    return text.includes(normalizePhaseText(query).trim());
  }), [allRows,tipo,source,stage,priority,query]);
  const provas = useMemo(() => filtered.filter(row => row.tipo==="provas"), [filtered]);
  const replica = useMemo(() => filtered.filter(row => row.tipo==="replica"), [filtered]);
  const unique = useMemo(() => new Set(allRows.map(row => row.key.split(":")[0])).size, [allRows]);
  const official = useMemo(() => allRows.filter(row => row.nivel==="tribunal").length, [allRows]);
  const attention = useMemo(() => allRows.filter(row => row.prioridade==="alta").length, [allRows]);
  const filterKey = [tipo,source,stage,priority,query].join("|");

  const exportExcel = async () => {
    const records = exportScope === "filtrados" ? filtered : allRows;
    if (!records.length || exporting) return;
    setExporting(true);setExportError("");
    try {
      // XLSX já é dependência do app; só carrega quando alguém exporta.
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const format = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
      const summary = [
        ["LexisPredict — triagem de réplicas e provas"],
        ["Gerado em", new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})],
        ["Abrangência", "Empresa autenticada — somente registros acessíveis"],
        ["Processos consultados", rowsScanned],
        ["Ocorrências exportadas", records.length],
        ["Escopo", exportScope === "filtrados" ? "Filtros atuais" : "Todos os registros carregados"],
        ["Situação da leitura", error ? "Interrompida" : busy ? "Parcial — consulta em andamento" : capped ? "Parcial — limite de 10.000 processos" : "Lotes consultados até o fim"],
        ["Critério", "Ato identificado é referência ao último DataJud/DJEN armazenado, não certificação de prazo aberto ou de fase judicial atual"],
        ["Registros internos", "Envio ou pendência descritos na carteira não substituem conferência de petição ou intimação"],
        ["Cobrança", "Não autorizada automaticamente por esta triagem; verificar contrato e responsável"],
        ["Data de retorno", "Data interna de acompanhamento, não prazo judicial"],
      ];
      const cover = XLSX.utils.aoa_to_sheet(summary.map(line => line.map(v => typeof v === "string" ? format(v) : v)));
      cover["!cols"] = [{wch:28},{wch:105}];
      XLSX.utils.book_append_sheet(wb,cover,"Orientações");
      for (const kind of ["provas","replica"] as const) {
        const rows = records.filter(row => row.tipo === kind);
        const sheet = XLSX.utils.aoa_to_sheet([TRIAGE_EXPORT_HEADERS,...rows.map(exportTriageRow)]);
        sheet["!cols"] = [28,27,12,34,28,19,54,55,31,65,18,28,27,25,18,28,19,19].map(wch => ({wch}));
        if (rows.length) sheet["!autofilter"] = {ref: XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:TRIAGE_EXPORT_HEADERS.length-1}})};
        XLSX.utils.book_append_sheet(wb,sheet,kind === "provas" ? "Provas" : "Réplicas");
      }
      XLSX.writeFile(wb,"LexisPredict_Fases_Provas_" + new Date().toISOString().slice(0,10) + ".xlsx",{compression:true});
    } catch (cause) {
      setExportError("Não foi possível gerar o Excel. " + (cause instanceof Error ? cause.message : "Tente novamente."));
    } finally { setExporting(false); }
  };

  return <main data-fases-provas className="mx-auto w-full max-w-[1800px] space-y-5 px-3 py-5 sm:px-7 sm:py-8">
    <header className="fp-hero rounded-3xl px-5 py-6 sm:px-8 sm:py-8">
      <p className="fp-hero-muted text-xs font-extrabold uppercase tracking-widest">LexisPredict · inteligência da carteira</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Réplica, provas e documentos</h1>
          <p className="fp-hero-muted mt-2 max-w-4xl text-sm leading-relaxed">Saiba o que foi encontrado, onde aparece e qual é o próximo passo. As confirmações exibidas dizem respeito aos registros consultados — não presumem prazo aberto.</p>
        </div>
        <ShieldCheck className="h-8 w-8 text-blue-200" aria-hidden/>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {[
          [rowsScanned,"processos consultados"],[unique,"processos com referências"],
          [allRows.length,"ocorrências identificadas"],[official,"com ato no último registro"],[attention,"ações prioritárias"],
        ].map(([count,label]) => <div key={label} className="fp-stat rounded-xl px-3 py-3"><p className="text-2xl font-black tabular-nums">{Number(count).toLocaleString("pt-BR")}</p><p className="fp-stat-label text-[11px] font-semibold">{label}</p></div>)}
      </div>
    </header>

    <section className="fp-card space-y-3 rounded-2xl p-4" aria-live="polite" role="status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" aria-hidden/> : error ? <AlertCircle className="h-5 w-5 text-red-700" aria-hidden/> : <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden/>}
          <div><p className="text-sm font-bold">{loadingInitial ? "Iniciando a consulta…" : loadingMore ? "Consultando os demais processos…" : error ? "Consulta interrompida; registros anteriores preservados" : capped ? "Limite de consulta atingido" : "Consulta dos lotes concluída"}</p>
            <p className="fp-muted text-xs">{rowsScanned.toLocaleString("pt-BR")} processos percorridos. {capped ? "Até 10.000 por consulta; resultado pode ser parcial." : "Use as evidências e filtros para localizar as próximas ações."}</p></div>
        </div>
        <button className="fp-button" type="button" disabled={busy} onClick={refresh}><RefreshCw className="h-4 w-4" /> Atualizar triagem</button>
      </div>
      {busy ? <div className="lexis-loading-track" aria-label="Consultando"><span/></div> : null}
      {error ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-red-700 dark:text-red-300">{error}</p><button type="button" className="fp-button" onClick={() => setRetryToken(v=>v+1)}>Retomar de onde parou</button></div> : null}
    </section>

    <section className="fp-card space-y-4 rounded-2xl p-4 sm:p-5" aria-label="Filtros e exportação">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-black"><Filter className="h-5 w-5" /> Filtrar e trabalhar os casos</h2><p className="fp-muted text-xs">{filtered.length.toLocaleString("pt-BR")} de {allRows.length.toLocaleString("pt-BR")} ocorrências</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1 text-xs font-semibold lg:col-span-2"><span className="fp-muted">Buscar cliente, CNJ ou ação</span>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4" /><input className="fp-input w-full pl-10" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nome ou número do processo" /></div>
        </label>
        <label className="space-y-1 text-xs font-semibold"><span className="fp-muted">Etapa</span>
          <select className="fp-input w-full" value={tipo} onChange={e=>setTipo(e.target.value as TypeFilter)}><option value="todos">Réplica e provas</option><option value="provas">Somente provas</option><option value="replica">Somente réplica</option></select>
        </label>
        <label className="space-y-1 text-xs font-semibold"><span className="fp-muted">Base da informação</span>
          <select className="fp-input w-full" value={source} onChange={e=>setSource(e.target.value as SourceFilter)}><option value="todos">Todas as fontes</option><option value="tribunal">Último registro do tribunal</option><option value="cadastro">Anotação interna</option><option value="mencao">Apenas menção</option></select>
        </label>
        <label className="space-y-1 text-xs font-semibold"><span className="fp-muted">Situação</span>
          <select className="fp-input w-full" value={stage} onChange={e=>setStage(e.target.value as StateFilter)}>
            <option value="todos">Todas</option><option value="intimacao">Intimação / providência</option><option value="enviado">Envio / juntada</option><option value="pendencia">Pendência</option><option value="pericia">Perícia</option><option value="decisao">Decisão posterior</option><option value="referencia">Menção genérica</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold" htmlFor="fp-priority">Prioridade</label>
          <select id="fp-priority" className="fp-input" value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="todos">Todas</option><option value="alta">Ação prioritária</option><option value="media">Acompanhar</option><option value="baixa">Baixa</option>
          </select>
          <button className="fp-button" type="button" onClick={() => {setQuery("");setTipo("todos");setSource("todos");setStage("todos");setPriority("todos");}}>Limpar filtros</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold" htmlFor="fp-export-scope">Exportar</label>
          <select id="fp-export-scope" className="fp-input" value={exportScope} onChange={e=>setExportScope(e.target.value as "filtrados"|"todos")}>
            <option value="filtrados">Resultados filtrados</option><option value="todos">Todos os carregados</option>
          </select>
          <button className="fp-button fp-button-primary" type="button" onClick={() => void exportExcel()} disabled={exporting || !(exportScope==="filtrados" ? filtered.length : allRows.length)}>
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}
            {exporting ? "Gerando Excel…" : "Baixar Excel (.xlsx)"}
          </button>
        </div>
      </div>
      {exportError ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{exportError}</p> : null}
      {busy || error || capped ? <p className="fp-muted text-xs">A exportação registra se a consulta estava parcial ou interrompida. Não apresenta resultados não carregados como conferidos.</p> : null}
    </section>

    <section className="fp-notice text-sm">
      <strong>Leitura objetiva:</strong> “Último ato consultado” significa que o DataJud ou DJEN armazenado contém a informação. “Registro interno” mostra o que a equipe anotou. Nenhuma dessas classificações, isoladamente, autoriza cobrança extra ou certifica prazo judicial vigente.
    </section>

    {tipo !== "replica" ? <section id="provas" className="space-y-3 scroll-mt-16">
      <div className="flex items-center gap-2"><FileSearch className="h-5 w-5"/><h2 className="text-xl font-black">Provas, documentos e perícias</h2></div>
      <ResultsTable items={provas} label="Provas e documentos" busy={busy} filterKey={filterKey}/>
    </section> : null}
    {tipo !== "provas" ? <section id="replica" className="space-y-3 scroll-mt-16">
      <h2 className="text-xl font-black">Réplica à contestação</h2>
      <ResultsTable items={replica} label="Réplica" busy={busy} filterKey={filterKey}/>
    </section> : null}
    <footer className="fp-muted flex flex-wrap items-center justify-between gap-2 pb-5 text-xs">
      <span>Origem: carteira da empresa e últimas informações DataJud/DJEN registradas no LexisPredict.</span>
      <Link className="fp-link" href="/processos">Abrir carteira de processos</Link>
    </footer>
  </main>;
}
