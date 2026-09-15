"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MAX_DB_BROWSER_BYTES,
  ZIP_SPLIT_THRESHOLD,
  listTables,
  exportTableCsvParts,
  downloadCsvsAsZipOrSplit,
  type SqlJsDb,
} from "@/lib/db-csv-export";

export default function DbCsvPage() {
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [db, setDb] = useState<SqlJsDb | null>(null);
  const [fileName, setFileName] = useState("");

  const onFile = async (file: File | null) => {
    setErr("");
    setInfo("");
    setTables([]);
    setDb(null);
    if (!file) return;
    if (!/\.(db|sqlite|sqlite3)$/i.test(file.name)) {
      setErr("Selecione .db / .sqlite");
      return;
    }
    if (file.size > MAX_DB_BROWSER_BYTES) {
      setErr(
        `Arquivo ${(file.size / 1e9).toFixed(2)} GB. No navegador o teto é ~450 MB. ` +
          `Para 5 GB: no DB Browser exporte 1 tabela por vez para .db menor, ou use SQLite CLI.`
      );
      return;
    }
    setBusy(true);
    try {
      const initSqlJs = (await import("sql.js")).default;
      const SQL = await initSqlJs({
        locateFile: (f: string) => `https://sql.js.org/dist/${f}`,
      });
      const buf = new Uint8Array(await file.arrayBuffer());
      const database = new SQL.Database(buf) as SqlJsDb;
      const names = listTables(database);
      setDb(database);
      setFileName(file.name);
      setTables(names);
      const sel: Record<string, boolean> = {};
      names.forEach((n) => (sel[n] = true));
      setSelected(sel);
      setInfo(`${file.name} · ${names.length} tabelas · só no seu PC (sem upload)`);
    } catch (e: any) {
      setErr(e?.message || "Falha ao abrir DB");
    } finally {
      setBusy(false);
    }
  };

  const exportAll = async () => {
    if (!db) return;
    setBusy(true);
    setErr("");
    try {
      const chosen = tables.filter((t) => selected[t]);
      if (!chosen.length) {
        setErr("Selecione ao menos uma tabela");
        return;
      }
      setInfo("Exportando CSV…");
      const files: { name: string; content: string }[] = [];
      for (const t of chosen) {
        setInfo(`Tabela: ${t}`);
        files.push(...exportTableCsvParts(db, t));
      }
      setInfo(
        `Gerando download (limite zip ${(ZIP_SPLIT_THRESHOLD / 1e6) | 0} MB)…`
      );
      const base = fileName.replace(/\.(db|sqlite3?)$/i, "") || "db-export";
      const r = await downloadCsvsAsZipOrSplit(files, base);
      setInfo(
        `Pronto: ${files.length} CSV(s) em ${r.zips} zip(s). Nada foi salvo no servidor.`
      );
    } catch (e: any) {
      setErr(e?.message || "Falha no export");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-lg font-black uppercase">DB → CSV</h1>
      <p className="text-sm text-muted-foreground">
        Abre SQLite no PC e baixa planilhas CSV. Acima de ~600 MB de saída, divide em vários ZIPs.
        Não envia o arquivo ao servidor.
      </p>
      <input
        type="file"
        accept=".db,.sqlite,.sqlite3"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      {info && <p className="text-xs text-emerald-700 whitespace-pre-wrap">{info}</p>}
      {err && <p className="text-xs text-rose-600 whitespace-pre-wrap">{err}</p>}

      {tables.length > 0 && (
        <>
          <div className="space-y-1 max-h-60 overflow-auto border rounded-md p-2">
            {tables.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!selected[t]}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [t]: e.target.checked }))
                  }
                />
                {t}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const s: Record<string, boolean> = {};
                tables.forEach((t) => (s[t] = true));
                setSelected(s);
              }}
            >
              Todas
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected({})}
            >
              Nenhuma
            </Button>
            <Button type="button" disabled={busy} onClick={exportAll}>
              {busy ? "Exportando…" : "Baixar CSV (ZIP)"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
