"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type CsvState = { fileName: string; size: number; columns: string[]; rows: string[][]; totalRows: number; malformed: number };

const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 250;

function parseRecord(record: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < record.length; i += 1) {
    const char = record[i];
    if (char === '"') {
      if (quoted && record[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values.map((item) => item.trim());
}

function splitRecords(text: string, carry: string) {
  const records: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '"') quoted = !quoted;
    if ((text[i] === "\n" || text[i] === "\r") && !quoted) {
      if (text[i] === "\r" && text[i + 1] === "\n") i += 1;
      records.push(carry + text.slice(start, i));
      carry = "";
      start = i + 1;
    }
  }
  return { records, carry: carry + text.slice(start) };
}

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function LocalCsvViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CsvState | null>(null);
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function readFile(file: File) {
    setReading(true); setError(""); setProgress(0); setState(null);
    const decoder = new TextDecoder("utf-8");
    let carry = "";
    let header: string[] | null = null;
    let delimiter = ",";
    const preview: string[][] = [];
    let totalRows = 0;
    let malformed = 0;
    try {
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        const text = decoder.decode(await file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size)).arrayBuffer(), { stream: offset + CHUNK_SIZE < file.size });
        const result = splitRecords(text, carry);
        carry = result.carry;
        for (const record of result.records) {
          if (!record.trim()) continue;
          if (!header) {
            delimiter = (record.match(/;/g)?.length || 0) > (record.match(/,/g)?.length || 0) ? ";" : ",";
            header = parseRecord(record.replace(/^\uFEFF/, ""), delimiter);
            continue;
          }
          const row = parseRecord(record, delimiter);
          totalRows += 1;
          if (row.length !== header.length) malformed += 1;
          if (preview.length < MAX_PREVIEW_ROWS) preview.push(row);
        }
        setProgress(Math.min(99, Math.round(((offset + CHUNK_SIZE) / file.size) * 100)));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const finalText = decoder.decode();
      carry += finalText;
      if (carry.trim() && header) { const row = parseRecord(carry, delimiter); totalRows += 1; if (row.length !== header.length) malformed += 1; if (preview.length < MAX_PREVIEW_ROWS) preview.push(row); }
      if (!header || totalRows === 0) throw new Error("O CSV precisa conter cabeçalho e pelo menos uma linha.");
      setState({ fileName: file.name, size: file.size, columns: header, rows: preview, totalRows, malformed });
      setProgress(100);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler o CSV."); }
    finally { setReading(false); }
  }

  return <div className="flex flex-col gap-5">
    <Card className="border-primary/20 bg-card/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="text-primary" /> Visualizador local de CSV</CardTitle><CardDescription>Leia arquivos grandes por blocos, sem upload e sem gravar no banco de dados.</CardDescription></div>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={reading}><Upload data-icon="inline-start" /> {reading ? "Lendo arquivo" : "Abrir CSV"}</Button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file?.name.toLowerCase().endsWith(".csv")) void readFile(file); else setError("Selecione um arquivo .csv."); }}>
          <Database className="mx-auto mb-2 text-primary" /> Arraste um CSV aqui ou use <button type="button" className="font-semibold text-primary underline" onClick={() => inputRef.current?.click()}>Abrir CSV</button>.<br /><span className="text-xs">O arquivo permanece no seu dispositivo durante toda a visualização.</span>
        </div>
        {reading && <div className="flex flex-col gap-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Lendo em blocos de 4 MB</span><span>{progress}%</span></div><Progress value={progress} /></div>}
        {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle /> {error}</div>}
        {state && <div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant="secondary"><CheckCircle2 data-icon="inline-start" /> Pronto</Badge><Badge variant="outline">{state.fileName}</Badge><Badge variant="outline">{formatBytes(state.size)}</Badge><Badge variant="outline">{state.totalRows.toLocaleString("pt-BR")} linhas</Badge><Badge variant="outline">{state.columns.length} colunas</Badge>{state.malformed > 0 && <Badge variant="destructive">{state.malformed} linhas irregulares</Badge>}<Button type="button" variant="ghost" size="sm" onClick={() => setState(null)}><X data-icon="inline-start" /> Fechar</Button></div>}
      </CardContent>
    </Card>
    {state && <Card className="overflow-hidden"><CardHeader><CardTitle>Prévia das primeiras {Math.min(MAX_PREVIEW_ROWS, state.totalRows).toLocaleString("pt-BR")} linhas</CardTitle><CardDescription>Somente a prévia fica em memória; o arquivo inteiro nunca é enviado ao app ou ao banco.</CardDescription></CardHeader><CardContent className="p-0"><div className="max-h-[min(60vh,620px)] overflow-auto"><table className="w-full min-w-max caption-bottom text-xs"><thead className="sticky top-0 bg-muted"><tr>{state.columns.map((column, index) => <th key={`${column}-${index}`} className="border-b px-3 py-2 text-left font-semibold">{column || `Coluna ${index + 1}`}</th>)}</tr></thead><tbody>{state.rows.map((row, rowIndex) => <tr key={rowIndex} className={cn("border-b last:border-0", row.length !== state.columns.length && "bg-destructive/10")}>{state.columns.map((_, columnIndex) => <td key={columnIndex} className="max-w-[280px] truncate px-3 py-2" title={row[columnIndex] || ""}>{row[columnIndex] || ""}</td>)}</tr>)}</tbody></table></div></CardContent></Card>}
  </div>;
}
