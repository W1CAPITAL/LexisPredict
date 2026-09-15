"use client";

import { useEffect, useRef, useState } from "react";
import initSqlJs, { type Database } from "sql.js";
import { AlertCircle, CheckCircle2, Database as DatabaseIcon, FileText, Loader2, Table2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MAX_ROWS = 250;

type TableInfo = { name: string; columns: string[]; rows: Array<Array<string | number | null>>; totalRows: number };

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function LocalDbViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [database, setDatabase] = useState<Database | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function closeDatabase() {
    database?.close();
    setDatabase(null); setFileInfo(null); setTables([]); setSelected(""); setFilter(""); setError("");
  }

  async function openFile(file: File) {
    setLoading(true); setError(""); closeDatabase();
    try {
      const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
      const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
      const result = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      const names = (result[0]?.values ?? []).map((row) => String(row[0]));
      if (!names.length) throw new Error("O arquivo SQLite não contém tabelas visíveis.");
      const infos = names.map((name): TableInfo => {
        const columnsResult = db.exec(`PRAGMA table_info(${quoteIdentifier(name)})`);
        const columns = (columnsResult[0]?.values ?? []).map((row) => String(row[1]));
        return { name, columns, rows: [], totalRows: 0 };
      });
      setDatabase(db); setFileInfo({ name: file.name, size: file.size }); setTables(infos); setSelected(names[0]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir este arquivo SQLite.");
    } finally { setLoading(false); }
  }

  function loadTable(name: string) {
    if (!database) return;
    setSelected(name); setError("");
    try {
      const quoted = quoteIdentifier(name);
      const count = database.exec(`SELECT COUNT(*) FROM ${quoted}`)[0]?.values[0]?.[0];
      const result = database.exec(`SELECT * FROM ${quoted} LIMIT ${MAX_ROWS}`)[0];
      const rows = (result?.values ?? []).map((row) => row.map((cell) => cell instanceof Uint8Array ? "[BLOB]" : cell as string | number | null));
      setTables((current) => current.map((table) => table.name === name ? { ...table, columns: result?.columns ?? table.columns, rows, totalRows: Number(count ?? 0) } : table));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler a tabela."); }
  }

  useEffect(() => {
    if (database && selected) loadTable(selected);
  }, [database, selected]);

  const current = tables.find((table) => table.name === selected);
  const visibleRows = current?.rows.filter((row) => !filter || row.some((cell) => String(cell ?? "").toLowerCase().includes(filter.toLowerCase()))) ?? [];

  return <div className="flex flex-col gap-5">
    <Card className="border-primary/20 bg-card/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2"><DatabaseIcon className="text-primary" /> Visualizador local de SQLite</CardTitle><CardDescription>Abra arquivos .db, .sqlite ou .sqlite3 diretamente no navegador. Nada é enviado ao app, Supabase ou banco de dados.</CardDescription></div><Button type="button" onClick={() => inputRef.current?.click()} disabled={loading}><Upload data-icon="inline-start" /> Abrir arquivo</Button><input ref={inputRef} type="file" accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void openFile(file); event.target.value = ""; }} /></CardHeader>
      <CardContent className="flex flex-col gap-4"><div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && /\.(db|sqlite3?)$/i.test(file.name)) void openFile(file); else setError("Selecione um arquivo .db, .sqlite ou .sqlite3."); }}><DatabaseIcon className="mx-auto mb-2 text-primary" /> Arraste seu arquivo SQLite aqui ou use <button type="button" className="font-semibold text-primary underline" onClick={() => inputRef.current?.click()}>Abrir arquivo</button>.<br /><span className="text-xs">A leitura acontece localmente. Arquivos grandes podem exigir memória livre no navegador.</span></div>{loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Abrindo o arquivo local…</div>}{error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Não foi possível abrir</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{fileInfo && <div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="secondary"><CheckCircle2 data-icon="inline-start" /> Somente local</Badge><Badge variant="outline"><FileText data-icon="inline-start" /> {fileInfo.name}</Badge><Badge variant="outline">{formatBytes(fileInfo.size)}</Badge><Badge variant="outline">{tables.length} tabelas</Badge><Button type="button" variant="ghost" size="sm" onClick={closeDatabase}><X data-icon="inline-start" /> Fechar</Button></div>}</CardContent>
    </Card>
    {current && <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"><Card><CardHeader><CardTitle className="text-base">Tabelas</CardTitle></CardHeader><CardContent className="flex flex-col gap-1">{tables.map((table) => <Button key={table.name} type="button" variant={selected === table.name ? "secondary" : "ghost"} className="justify-start" onClick={() => loadTable(table.name)}><Table2 data-icon="inline-start" />{table.name}</Button>)}</CardContent></Card><Card className="min-w-0 overflow-hidden"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{current.name}</CardTitle><CardDescription>{current.totalRows.toLocaleString("pt-BR")} registros; mostrando até {MAX_ROWS} localmente.</CardDescription></div><Input aria-label="Filtrar linhas" placeholder="Filtrar linhas" value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full sm:w-56" /></div></CardHeader><CardContent className="p-0"><div className="max-h-[min(60vh,620px)] overflow-auto"><Table><TableHeader className="sticky top-0 bg-muted"><TableRow>{current.columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{visibleRows.map((row, index) => <TableRow key={index}>{current.columns.map((_, columnIndex) => <TableCell key={columnIndex} className="max-w-[280px] truncate" title={String(row[columnIndex] ?? "")}>{String(row[columnIndex] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table>{!visibleRows.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhum registro corresponde ao filtro.</p>}</div></CardContent></Card></div>}
  </div>;
}

export default LocalDbViewer;
