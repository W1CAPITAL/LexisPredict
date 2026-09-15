/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type Cell = string | number | bigint | null;
type ColumnMap = { nome: string; cpf: string; telefone: string };
type TableSchema = { name: string; columns: string[] };

const worker = self as unknown as DedicatedWorkerGlobalScope;
const OPFS_PATH = "/lexispredict/detran-local.sqlite3";
const IMPORT_CHUNK = 8 * 1024 * 1024;

let sqlite3: any;
let database: any;
let schemas: TableSchema[] = [];

function post(type: string, payload: Record<string, unknown> = {}) {
  worker.postMessage({ type, ...payload });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || "Erro desconhecido");
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function assertMapped(table: string, column: string) {
  const schema = schemas.find((item) => item.name === table);
  if (!schema || !schema.columns.includes(column)) {
    throw new Error("Tabela ou coluna inválida. Reabra a base e tente novamente.");
  }
}

function normalizeValue(value: unknown): Cell | string {
  if (value instanceof Uint8Array) return "[BLOB]";
  if (typeof value === "bigint") return value.toString();
  return value == null || typeof value === "string" || typeof value === "number"
    ? value as Cell
    : String(value);
}

async function initialize() {
  if (sqlite3) return;
  // @sqlite.org/sqlite-wasm tipa init sem argumentos; print/printErr não são aceitos no tipo atual
  sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1?.OpfsDb) {
    throw new Error("Este navegador não oferece SQLite OPFS. Use Chrome, Edge ou Firefox atualizado.");
  }
}

async function importDatabase(file: File) {
  await initialize();
  database?.close();
  database = undefined;
  schemas = [];

  let offset = 0;
  await sqlite3.oo1.OpfsDb.importDb(OPFS_PATH, async () => {
    if (offset >= file.size) return undefined;
    const end = Math.min(file.size, offset + IMPORT_CHUNK);
    const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    offset = end;
    post("import-progress", { loaded: offset, total: file.size });
    return bytes;
  });

  database = new sqlite3.oo1.OpfsDb(OPFS_PATH, "r");
  const tableNames = database.selectValues(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ) as string[];
  if (!tableNames.length) throw new Error("O arquivo SQLite não contém tabelas visíveis.");

  schemas = tableNames.map((name) => ({
    name,
    columns: (database.selectObjects(`PRAGMA table_info(${quoteIdentifier(name)})`) as Array<Record<string, unknown>>)
      .map((row) => String(row.name)),
  }));
  post("ready", { schemas, file: { name: file.name, size: file.size } });
}

function digitsExpression(column: string) {
  let expression = `CAST(${quoteIdentifier(column)} AS TEXT)`;
  for (const character of [".", "-", "/", "(", ")", " ", "+"]) {
    expression = `replace(${expression}, '${character}', '')`;
  }
  return expression;
}

function queryDatabase(payload: {
  table: string;
  field: keyof ColumnMap;
  query: string;
  mapping: ColumnMap;
  limit?: number;
}) {
  if (!database) throw new Error("Abra a base DETRAN antes de consultar.");
  const { table, field, mapping } = payload;
  const column = mapping[field];
  assertMapped(table, column);
  const term = payload.query.trim();
  if (!term) throw new Error("Digite um nome, CPF ou telefone.");
  const limit = Math.min(500, Math.max(1, payload.limit || 200));
  const normalizedDigits = field === "nome" ? "" : term.replace(/\D/g, "");
  const escapedName = term.replace(/([%_\\])/g, "\\$1");
  const where = field === "nome"
    ? `CAST(${quoteIdentifier(column)} AS TEXT) LIKE ? ESCAPE '\\' COLLATE NOCASE`
    : field === "telefone"
      ? `(${digitsExpression(column)} = ? OR ${digitsExpression(column)} LIKE ?)`
      : `${digitsExpression(column)} = ?`;
  const value = field === "nome" ? `%${escapedName}%` : normalizedDigits;
  if (field !== "nome" && !value) throw new Error("Informe apenas um CPF ou telefone válido.");
  const bind = field === "telefone" ? [value, `%${value}`] : [value];

  const rows = database.selectObjects(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE ${where} LIMIT ${limit + 1}`,
    bind,
  ) as Array<Record<string, unknown>>;
  const capped = rows.length > limit;
  const visible = rows.slice(0, limit).map((row) => Object.fromEntries(
    Object.entries(row).map(([key, cell]) => [key, normalizeValue(cell)]),
  ));
  post("results", { rows: visible, capped });
}

worker.onmessage = async (event: MessageEvent) => {
  try {
    const message = event.data;
    if (message.type === "import") await importDatabase(message.file);
    if (message.type === "query") queryDatabase(message);
    if (message.type === "close") {
      database?.close();
      database = undefined;
      schemas = [];
      post("closed");
    }
    if (message.type === "delete") {
      database?.close();
      database = undefined;
      schemas = [];
      const root = await navigator.storage.getDirectory();
      const directory = await root.getDirectoryHandle("lexispredict");
      for (const name of ["detran-local.sqlite3", "detran-local.sqlite3-journal", "detran-local.sqlite3-wal", "detran-local.sqlite3-shm"]) {
        try { await directory.removeEntry(name); } catch { /* Optional sidecar may not exist. */ }
      }
      post("deleted");
    }
  } catch (cause) {
    post("error", { message: errorMessage(cause) });
  }
};

export {};
