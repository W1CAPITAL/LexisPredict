/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type Cell = string | number | bigint | null;
type ColumnMap = { nome: string; cpf: string; telefone: string };
type TableSchema = { name: string; columns: string[] };

const worker = self as unknown as DedicatedWorkerGlobalScope;
const OPFS_PATH = "/lexispredict/detran-local.sqlite3";
const IMPORT_CHUNK = 4 * 1024 * 1024; // 4 MB — mais callbacks de progresso

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

function digitsExpression(column: string) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CAST(${quoteIdentifier(column)} AS TEXT),' ',''),'.',''),'-',''),'/',''),'(','')`;
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
    ? (value as Cell)
    : String(value);
}

async function initialize() {
  if (sqlite3) return;
  post("log", { message: "Iniciando SQLite WASM…" });
  sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1?.OpfsDb) {
    throw new Error(
      "Este navegador não oferece SQLite OPFS. Use Chrome ou Edge atualizado (não use aba anônima sem permissão de armazenamento)."
    );
  }
  post("log", { message: "SQLite WASM pronto." });
}

async function importDatabase(file: File) {
  post("import-progress", { loaded: 0, total: file.size, phase: "start" });
  await initialize();

  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const free = (est.quota || 0) - (est.usage || 0);
      if (free > 0 && free < file.size * 1.05) {
        throw new Error(
          `Espaço OPFS insuficiente (~${(free / 1e9).toFixed(2)} GB livre, arquivo ${(file.size / 1e9).toFixed(2)} GB). Libere disco ou use outro perfil do Chrome.`
        );
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("OPFS")) throw e;
  }

  database?.close();
  database = undefined;
  schemas = [];

  let offset = 0;
  let lastPost = 0;
  post("import-progress", { loaded: 0, total: file.size, phase: "copy" });

  await sqlite3.oo1.OpfsDb.importDb(OPFS_PATH, async () => {
    if (offset >= file.size) return undefined;
    const end = Math.min(file.size, offset + IMPORT_CHUNK);
    const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    offset = end;
    // throttle UI updates (~every 2%)
    const pct = file.size ? offset / file.size : 1;
    if (offset - lastPost >= IMPORT_CHUNK * 2 || offset >= file.size || pct - lastPost / file.size >= 0.02) {
      lastPost = offset;
      post("import-progress", { loaded: offset, total: file.size, phase: "copy" });
    }
    return bytes;
  });

  post("import-progress", { loaded: file.size, total: file.size, phase: "open" });
  database = new sqlite3.oo1.OpfsDb(OPFS_PATH, "r");
  const tableNames = database.selectValues(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ) as string[];
  if (!tableNames.length) throw new Error("O arquivo SQLite não contém tabelas visíveis.");

  schemas = tableNames.map((name) => ({
    name,
    columns: (
      database.selectObjects(`PRAGMA table_info(${quoteIdentifier(name)})`) as Array<Record<string, unknown>>
    ).map((row) => String(row.name)),
  }));

  post("ready", {
    file: { name: file.name, size: file.size },
    schemas,
  });
  post("import-progress", { loaded: file.size, total: file.size, phase: "done" });
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
  const limit = Math.min(2000, Math.max(1, payload.limit || 200));
  const normalizedDigits = field === "nome" ? "" : term.replace(/\D/g, "");
  const escapedName = term.replace(/([%_\\])/g, "\\$1");
  const where =
    field === "nome"
      ? `CAST(${quoteIdentifier(column)} AS TEXT) LIKE ? ESCAPE '\\' COLLATE NOCASE`
      : field === "telefone"
        ? `(${digitsExpression(column)} = ? OR ${digitsExpression(column)} LIKE ?)`
        : `${digitsExpression(column)} = ?`;
  const value = field === "nome" ? `%${escapedName}%` : normalizedDigits;
  if (field !== "nome" && !value) throw new Error("Informe apenas um CPF ou telefone válido.");
  const bind = field === "telefone" ? [value, `%${value}`] : [value];

  const rows = database.selectObjects(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE ${where} LIMIT ${limit + 1}`,
    bind
  ) as Array<Record<string, unknown>>;
  const capped = rows.length > limit;
  const visible = rows.slice(0, limit).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, normalizeValue(cell)]))
  );
  post("results", { rows: visible, capped });
}

/** Navegar páginas sem carregar 14 milhões na memória da UI. */
function browseDatabase(payload: { table: string; offset?: number; limit?: number }) {
  if (!database) throw new Error("Abra a base DETRAN antes de visualizar.");
  const table = payload.table;
  const schema = schemas.find((s) => s.name === table);
  if (!schema) throw new Error("Tabela inválida.");
  const limit = Math.min(500, Math.max(1, payload.limit || 100));
  const offset = Math.max(0, payload.offset || 0);
  const total = Number(
    database.selectValue(`SELECT COUNT(*) FROM ${quoteIdentifier(table)}`) || 0
  );
  const rows = database.selectObjects(
    `SELECT * FROM ${quoteIdentifier(table)} LIMIT ${limit} OFFSET ${offset}`
  ) as Array<Record<string, unknown>>;
  const visible = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, normalizeValue(cell)]))
  );
  post("browse", { rows: visible, offset, limit, total, table });
}

worker.onmessage = async (event: MessageEvent) => {
  try {
    const message = event.data;
    if (message.type === "import") await importDatabase(message.file);
    if (message.type === "query") queryDatabase(message);
    if (message.type === "browse") browseDatabase(message);
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
      for (const name of [
        "detran-local.sqlite3",
        "detran-local.sqlite3-journal",
        "detran-local.sqlite3-wal",
        "detran-local.sqlite3-shm",
      ]) {
        try {
          await directory.removeEntry(name);
        } catch {
          /* optional */
        }
      }
      post("deleted");
    }
  } catch (cause) {
    post("error", { message: errorMessage(cause) });
  }
};

export {};
