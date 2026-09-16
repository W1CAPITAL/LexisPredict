"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, Database, Download, Eye, EyeOff, FileSpreadsheet,
  HardDrive, Loader2, Search, ShieldCheck, Upload, X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchField = "nome" | "cpf" | "telefone";
type Mapping = Record<SearchField, string>;
type FileInfo = { name: string; size: number };
type DbSchema = { name: string; columns: string[] };
type DbRow = Record<string, string | number | null>;

const EMPTY_MAPPING: Mapping = { nome: "", cpf: "", telefone: "" };
const FIELD_LABELS: Record<SearchField, string> = { nome: "Nome", cpf: "CPF", telefone: "Telefone" };

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function autoMapping(columns: string[]): Mapping {
  const normalized = columns.map((column) => ({
    column,
    key: column.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));
  const pick = (patterns: RegExp[]) => normalized.find((item) => patterns.some((pattern) => pattern.test(item.key)))?.column || "";
  return {
    nome: pick([/^nome$/, /^nomecompleto$/, /nomecliente/, /nomedapessoa/]),
    cpf: pick([/^cpf$/, /cpfcnpj/, /documento/, /numcpf/]),
    telefone: pick([/^telefone$/, /^celular$/, /fone/, /whatsapp/, /telefone1/]),
  };
}

function maskCpf(value: string) {
  const number = value.replace(/\D/g, "");
  if (number.length !== 11) return "•••••••••••";
  return `***.${number.slice(3, 6)}.${number.slice(6, 9)}-**`;
}

function maskPhone(value: string) {
  const number = value.replace(/\D/g, "");
  if (number.length < 8) return "••••••••";
  return `${number.slice(0, Math.max(0, number.length - 6))}*****${number.slice(-2)}`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[";,\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(columns: string[], rows: Array<Array<unknown>>, source: string) {
  const contents = [columns, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `consulta-${source}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function MappingFields({ columns, value, onChange }: { columns: string[]; value: Mapping; onChange: (value: Mapping) => void }) {
  return <div className="grid gap-3 sm:grid-cols-3">
    {(Object.keys(FIELD_LABELS) as SearchField[]).map((field) => <label key={field} className="space-y-1.5 text-sm">
      <span className="font-medium">Coluna de {FIELD_LABELS[field]}</span>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value[field]}
        onChange={(event) => onChange({ ...value, [field]: event.target.value })}
      >
        <option value="">Selecione…</option>
        {columns.map((column) => <option key={column} value={column}>{column}</option>)}
      </select>
    </label>)}
  </div>;
}

function QueryForm({ field, query, busy, disabled, onField, onQuery, onSearch }: {
  field: SearchField; query: string; busy: boolean; disabled: boolean;
  onField: (field: SearchField) => void; onQuery: (query: string) => void; onSearch: () => void;
}) {
  return <form className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
    <select aria-label="Tipo de consulta" className="h-10 rounded-md border bg-background px-3 text-sm" value={field} onChange={(event) => onField(event.target.value as SearchField)}>
      {(Object.keys(FIELD_LABELS) as SearchField[]).map((key) => <option key={key} value={key}>{FIELD_LABELS[key]}</option>)}
    </select>
    <Input aria-label="Termo da consulta" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`Pesquisar no arquivo local (ex.: nome completo)…`} />
    <Button type="submit" disabled={disabled || busy || !query.trim()} title="Buscar só neste arquivo local (até 2000 resultados)">
      {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Search data-icon="inline-start" />}
      {busy ? "Consultando…" : "Consultar"}
    </Button>
  </form>;
}

function ResultTable({ columns, rows, mapping, reveal, onReveal, source }: {
  columns: string[]; rows: Array<Array<unknown>>; mapping: Mapping; reveal: boolean; onReveal: () => void; source: string;
}) {
  const sensitive = new Set([mapping.cpf, mapping.telefone].filter(Boolean));
  const display = (column: string, value: unknown) => {
    const text = String(value ?? "");
    if (reveal || !sensitive.has(column)) return text;
    return column === mapping.cpf ? maskCpf(text) : maskPhone(text);
  };
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><CardTitle className="text-lg">Resultados</CardTitle><CardDescription>{rows.length.toLocaleString("pt-BR")} registro(s) nesta consulta.</CardDescription></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReveal}>{reveal ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}{reveal ? "Ocultar dados" : "Revelar dados"}</Button>
        <Button type="button" variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv(columns, rows, source)}><Download data-icon="inline-start" /> Baixar CSV</Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="max-h-[62vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>{columns.map((column) => <TableHead key={column} className="whitespace-nowrap">{column}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex}>{columns.map((column, columnIndex) => <TableCell key={`${rowIndex}-${column}`} className="max-w-[300px] truncate" title={display(column, row[columnIndex])}>{display(column, row[columnIndex])}</TableCell>)}</TableRow>)}</TableBody>
        </Table>
        {!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">Faça uma consulta para exibir os resultados.</p>}
      </div>
    </CardContent>
  </Card>;
}

export function ConsultaBases() {
  const detranInput = useRef<HTMLInputElement>(null);
  const credilinkInput = useRef<HTMLInputElement>(null);
  const detranWorker = useRef<Worker | null>(null);
  const credilinkWorker = useRef<Worker | null>(null);

  const [detranFile, setDetranFile] = useState<FileInfo>();
  const [detranSchemas, setDetranSchemas] = useState<DbSchema[]>([]);
  const [detranTable, setDetranTable] = useState("");
  const [detranMapping, setDetranMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [detranField, setDetranField] = useState<SearchField>("nome");
  const [detranQuery, setDetranQuery] = useState("");
  const [detranRows, setDetranRows] = useState<DbRow[]>([]);
  const [detranBusy, setDetranBusy] = useState(false);
  const [detranProgress, setDetranProgress] = useState(0);
  const [detranError, setDetranError] = useState("");
  const [detranCapped, setDetranCapped] = useState(false);
  const [detranBrowseOffset, setDetranBrowseOffset] = useState(0);
  const [detranBrowseTotal, setDetranBrowseTotal] = useState(0);
  const [credilinkByteOffset, setCredilinkByteOffset] = useState(0);
  const [credilinkBrowseDone, setCredilinkBrowseDone] = useState(false);
  const [detranStatus, setDetranStatus] = useState("");
  const [credilinkStatus, setCredilinkStatus] = useState("");

  const [credilinkFile, setCredilinkFile] = useState<FileInfo>();
  const [credilinkColumns, setCredilinkColumns] = useState<string[]>([]);
  const [credilinkMapping, setCredilinkMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [credilinkField, setCredilinkField] = useState<SearchField>("nome");
  const [credilinkQuery, setCredilinkQuery] = useState("");
  const [credilinkRows, setCredilinkRows] = useState<string[][]>([]);
  const [credilinkBusy, setCredilinkBusy] = useState(false);
  const [credilinkProgress, setCredilinkProgress] = useState(0);
  const [credilinkError, setCredilinkError] = useState("");
  const [credilinkCapped, setCredilinkCapped] = useState(false);
  const [credilinkEncoding, setCredilinkEncoding] = useState("utf-8");
  const [reveal, setReveal] = useState(false);

  const selectedSchema = useMemo(() => detranSchemas.find((schema) => schema.name === detranTable), [detranSchemas, detranTable]);
  const detranColumns = detranRows[0] ? Object.keys(detranRows[0]) : selectedSchema?.columns || [];
  const detranMatrix = detranRows.map((row) => detranColumns.map((column) => row[column]));

  useEffect(() => {
    const dbWorker = new Worker(new URL("../../workers/detran-sqlite.worker.ts", import.meta.url), { type: "module" });
    const csvWorker = new Worker(new URL("../../workers/credilink-csv.worker.ts", import.meta.url), { type: "module" });
    detranWorker.current = dbWorker;
    credilinkWorker.current = csvWorker;

    dbWorker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "import-progress") {
        const pct = message.total ? Math.round((message.loaded / message.total) * 100) : 0;
        setDetranProgress(Math.max(1, pct)); // evita ficar preso em 0% visual
      }
      if (message.type === "log") {
        setDetranError(""); // limpa
      }
      if (message.type === "ready") {
        const schemas = message.schemas as DbSchema[];
        setDetranFile(message.file); setDetranSchemas(schemas); setDetranTable(schemas[0].name);
        setDetranMapping(autoMapping(schemas[0].columns)); setDetranProgress(100); setDetranBusy(false);
      }
      if (message.type === "results") { setDetranRows(message.rows); setDetranCapped(message.capped); setDetranBusy(false); setDetranStatus(""); }
      if (message.type === "browse" && message.rows && !message.columns) {
        setDetranRows(message.rows);
        setDetranBrowseOffset(message.offset || 0);
        setDetranBrowseTotal(message.total || 0);
        setDetranBusy(false);
        setDetranStatus(`Visualizando ${message.offset + 1}–${message.offset + message.rows.length} de ${message.total}`);
      }
      if (message.type === "deleted") { setDetranFile(undefined); setDetranSchemas([]); setDetranRows([]); setDetranProgress(0); setDetranBusy(false); }
      if (message.type === "error") { setDetranError(message.message); setDetranBusy(false); }
    };
    csvWorker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "search-progress") setCredilinkProgress(Math.round((message.loaded / message.total) * 100));
      if (message.type === "ready") {
        setCredilinkFile(message.file); setCredilinkColumns(message.columns); setCredilinkMapping(autoMapping(message.columns));
        setCredilinkProgress(100); setCredilinkBusy(false); setCredilinkStatus("Cabeçalho lido. Busque ou visualize páginas de 200 linhas.");
        if (message.dataStart) setCredilinkByteOffset(message.dataStart);
      }
      if (message.type === "results") { setCredilinkRows(message.rows); setCredilinkCapped(message.capped); setCredilinkBusy(false); setCredilinkProgress(100); }
      if (message.type === "error") { setCredilinkError(message.message); setCredilinkBusy(false); }
    };
    return () => { dbWorker.terminate(); csvWorker.terminate(); };
  }, []);

  function openDetran(file: File) {
    if (!/\.(db|sqlite|sqlite3)$/i.test(file.name)) { setDetranError("Descompacte o ZIP e selecione um arquivo .db, .sqlite ou .sqlite3."); return; }
    setDetranError(""); setDetranBusy(true); setDetranProgress(1); setDetranRows([]);
    setDetranStatus(`Copiando ${formatBytes(file.size)} para OPFS local (não sobe para a Vercel)…`);
    void navigator.storage?.persist?.();
    detranWorker.current?.postMessage({ type: "import", file });
  }

  function browseDetran(offset = 0) {
    if (!detranTable) { setDetranError("Selecione a tabela."); return; }
    setDetranBusy(true); setDetranError("");
    detranWorker.current?.postMessage({ type: "browse", table: detranTable, offset, limit: 100 });
  }

  function browseCredilink(byteOffset?: number) {
    setCredilinkBusy(true); setCredilinkError("");
    credilinkWorker.current?.postMessage({ type: "browse", byteOffset: byteOffset ?? credilinkByteOffset, limit: 200 });
  }

  function openCredilink(file: File) {
    if (!/\.csv$/i.test(file.name)) { setCredilinkError("Descompacte o ZIP e selecione o arquivo .csv."); return; }
    setCredilinkError(""); setCredilinkBusy(true); setCredilinkProgress(1); setCredilinkRows([]);
    setCredilinkStatus(`Lendo cabeçalho de ${formatBytes(file.size)} no seu PC…`);
    setCredilinkByteOffset(0);
    credilinkWorker.current?.postMessage({ type: "open", file, encoding: credilinkEncoding });
  }

  function searchDetran() {
    setDetranError(""); setDetranRows([]); setDetranBusy(true); setDetranCapped(false);
    detranWorker.current?.postMessage({ type: "query", table: detranTable, field: detranField, query: detranQuery, mapping: detranMapping, limit: 2000 });
  }

  function searchCredilink() {
    setCredilinkError(""); setCredilinkRows([]); setCredilinkBusy(true); setCredilinkCapped(false); setCredilinkProgress(0);
    credilinkWorker.current?.postMessage({ type: "search", field: credilinkField, query: credilinkQuery, mapping: credilinkMapping });
  }

  return <div className="space-y-5">
    <Alert className="border-emerald-500/30 bg-emerald-500/5">
      <ShieldCheck className="text-emerald-600" /><AlertTitle>Modo local — Supabase bloqueado por arquitetura</AlertTitle>
      <AlertDescription>Consulta só no arquivo do seu PC (não sobe para a Vercel). Digite nome, CPF ou telefone — a busca percorre o DB/CSV local e mostra até 2000 resultados na tela (como uma busca Google, mas só nesta base). Carregar 14 milhões de linhas de uma vez trava o navegador; use a busca ou “próxima página” para folhear.</AlertDescription>
    </Alert>

    <Tabs defaultValue="detran" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-[440px]">
        <TabsTrigger value="detran" className="gap-2 py-2.5"><Database size={16} /> DETRAN (.db)</TabsTrigger>
        <TabsTrigger value="credilink" className="gap-2 py-2.5"><FileSpreadsheet size={16} /> Credilink (.csv)</TabsTrigger>
      </TabsList>

      <TabsContent value="detran" className="space-y-5">
        <Card><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Base DETRAN</CardTitle><CardDescription>Descompacte o arquivo e selecione o .db. A primeira preparação pode levar alguns minutos e exige espaço livre equivalente ao arquivo.</CardDescription></div><Button type="button" onClick={() => detranInput.current?.click()} disabled={detranBusy}><Upload data-icon="inline-start" /> Selecionar .db</Button><input ref={detranInput} type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) openDetran(file); event.target.value = ""; }} /></CardHeader>
          <CardContent className="space-y-4">
            {detranBusy && detranProgress < 100 && <div className="space-y-2"><div className="flex justify-between text-sm"><span>Preparando cópia local…</span><span>{detranProgress}%</span></div><Progress value={detranProgress} /></div>}
            {detranError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Erro no DETRAN</AlertTitle><AlertDescription>{detranError}</AlertDescription></Alert>}
            {detranFile && <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><CheckCircle2 data-icon="inline-start" /> Pronto</Badge><Badge variant="outline"><HardDrive data-icon="inline-start" /> {detranFile.name}</Badge><Badge variant="outline">{formatBytes(detranFile.size)}</Badge><Button variant="ghost" size="sm" onClick={() => { detranWorker.current?.postMessage({ type: "close" }); setDetranFile(undefined); setDetranSchemas([]); setDetranRows([]); }}><X data-icon="inline-start" /> Fechar</Button><Button variant="outline" size="sm" disabled={detranBusy} onClick={() => { setDetranBusy(true); detranWorker.current?.postMessage({ type: "delete" }); }}>Remover cópia local</Button></div>}
            {!!detranSchemas.length && <><label className="block space-y-1.5 text-sm"><span className="font-medium">Tabela do banco</span><select className="h-10 w-full rounded-md border bg-background px-3 sm:max-w-md" value={detranTable} onChange={(event) => { const table = event.target.value; const schema = detranSchemas.find((item) => item.name === table); setDetranTable(table); setDetranMapping(autoMapping(schema?.columns || [])); setDetranRows([]); }}>{detranSchemas.map((schema) => <option key={schema.name}>{schema.name}</option>)}</select></label><MappingFields columns={selectedSchema?.columns || []} value={detranMapping} onChange={setDetranMapping} /><QueryForm field={detranField} query={detranQuery} busy={detranBusy} disabled={!detranMapping[detranField]} onField={setDetranField} onQuery={setDetranQuery} onSearch={searchDetran} />
            <div className="flex flex-wrap gap-2 items-center mt-2">
              <Button type="button" variant="outline" size="sm" disabled={!detranFile || !detranTable || detranBusy} onClick={() => browseDetran(0)}>Visualizar (100 linhas)</Button>
              <Button type="button" variant="outline" size="sm" disabled={!detranFile || !detranTable || detranBusy || detranBrowseOffset <= 0} onClick={() => browseDetran(Math.max(0, detranBrowseOffset - 100))}>Anterior</Button>
              <Button type="button" variant="outline" size="sm" disabled={!detranFile || !detranTable || detranBusy || (detranBrowseTotal > 0 && detranBrowseOffset + 100 >= detranBrowseTotal)} onClick={() => browseDetran(detranBrowseOffset + 100)}>Próxima</Button>
              {detranStatus ? <span className="text-xs text-muted-foreground">{detranStatus}</span> : null}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Fluxo principal: digite o nome (ou CPF/telefone) e busque — até 2000 linhas na tabela. “Visualizar” só folheia 100 por página. Arquivo 4–5 GB: espere a barra ao copiar para OPFS (local).</p></>}
          </CardContent>
        </Card>
        {detranCapped && <Alert><AlertCircle /><AlertTitle>Resultado limitado</AlertTitle><AlertDescription>Foram exibidos os primeiros 500 registros. Refine o termo para reduzir a lista.</AlertDescription></Alert>}
        {!!detranSchemas.length && <ResultTable columns={detranColumns} rows={detranMatrix} mapping={detranMapping} reveal={reveal} onReveal={() => setReveal((value) => !value)} source="detran" />}
      </TabsContent>

      <TabsContent value="credilink" className="space-y-5">
        <Card><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Base Credilink</CardTitle><CardDescription>Descompacte o ZIP e selecione o CSV. Cada consulta percorre o arquivo completo localmente, sem upload.</CardDescription></div><div className="flex flex-wrap gap-2"><select aria-label="Codificação do CSV" className="h-10 rounded-md border bg-background px-3 text-sm" value={credilinkEncoding} onChange={(event) => setCredilinkEncoding(event.target.value)}><option value="utf-8">UTF-8</option><option value="windows-1252">Windows/ANSI</option></select><Button type="button" onClick={() => credilinkInput.current?.click()} disabled={credilinkBusy}><Upload data-icon="inline-start" /> Selecionar CSV</Button></div><input ref={credilinkInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) openCredilink(file); event.target.value = ""; }} /></CardHeader>
          <CardContent className="space-y-4">
            {credilinkBusy && <div className="space-y-2"><div className="flex justify-between text-sm"><span>{credilinkFile ? "Varrendo o arquivo…" : "Lendo cabeçalho…"}</span><span>{credilinkProgress}%</span></div><Progress value={credilinkProgress} /></div>}
            {credilinkError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Erro no Credilink</AlertTitle><AlertDescription>{credilinkError}</AlertDescription></Alert>}
            {credilinkFile && <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary"><CheckCircle2 data-icon="inline-start" /> Pronto</Badge><Badge variant="outline"><FileSpreadsheet data-icon="inline-start" /> {credilinkFile.name}</Badge><Badge variant="outline">{formatBytes(credilinkFile.size)}</Badge><Button variant="ghost" size="sm" onClick={() => { credilinkWorker.current?.postMessage({ type: "close" }); setCredilinkFile(undefined); setCredilinkColumns([]); setCredilinkRows([]); }}><X data-icon="inline-start" /> Fechar</Button></div>}
            {!!credilinkColumns.length && <><MappingFields columns={credilinkColumns} value={credilinkMapping} onChange={setCredilinkMapping} /><QueryForm field={credilinkField} query={credilinkQuery} busy={credilinkBusy} disabled={!credilinkMapping[credilinkField]} onField={setCredilinkField} onQuery={setCredilinkQuery} onSearch={searchCredilink} />
            <div className="flex flex-wrap gap-2 items-center mt-2">
              <Button type="button" variant="outline" size="sm" disabled={!credilinkFile || credilinkBusy} onClick={() => { setCredilinkByteOffset(0); browseCredilink(0); }}>Visualizar (200 linhas)</Button>
              <Button type="button" variant="outline" size="sm" disabled={!credilinkFile || credilinkBusy || credilinkBrowseDone} onClick={() => browseCredilink()}>Próximas 200</Button>
              {credilinkStatus ? <span className="text-xs text-muted-foreground">{credilinkStatus}</span> : null}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Fluxo principal: busca por nome/CPF/telefone no CSV local (até 2000 na tela). “Visualizar” = 200 por página.</p></>}
          </CardContent>
        </Card>
        {credilinkCapped && <Alert><AlertCircle /><AlertTitle>Resultado limitado</AlertTitle><AlertDescription>Foram exibidos os primeiros 500 registros. Refine o termo para reduzir a lista.</AlertDescription></Alert>}
        {!!credilinkColumns.length && <ResultTable columns={credilinkColumns} rows={credilinkRows} mapping={credilinkMapping} reveal={reveal} onReveal={() => setReveal((value) => !value)} source="credilink" />}
      </TabsContent>
    </Tabs>
  </div>;
}
