/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import {
  buildQueryIndex,
  matchRow,
  onlyDigits,
  normName,
  pickColumns,
  type EnrichHit,
  type EnrichQuery,
} from "../lib/enrich-local-base";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const OPFS_PATH = "/lexispredict/detran-local.sqlite3";
const CHUNK = 2 * 1024 * 1024;

function post(type: string, payload: Record<string, unknown> = {}) {
  worker.postMessage({ type, ...payload });
}

function err(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || "Erro");
}

function detectDelim(line: string) {
  const sc = (line.match(/;/g) || []).length;
  const cc = (line.match(/,/g) || []).length;
  return sc >= cc ? ";" : ",";
}

function autoMap(headers: string[], mapping: Record<string, string>) {
  const auto = pickColumns(headers);
  return {
    cpf: mapping.cpf && headers.includes(mapping.cpf) ? mapping.cpf : auto.cpf,
    nome: mapping.nome && headers.includes(mapping.nome) ? mapping.nome : auto.nome,
    telefone: mapping.telefone && headers.includes(mapping.telefone) ? mapping.telefone : auto.telefone,
    email: mapping.email && headers.includes(mapping.email) ? mapping.email : auto.email,
  };
}

async function scanCsvFile(
  file: File,
  index: ReturnType<typeof buildQueryIndex>,
  hits: Record<string, EnrichHit>,
  mapping: Record<string, string>,
  encoding: string
) {
  let scanned = 0;
  let matched = 0;
  const sample = new TextDecoder(encoding).decode(await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer());
  const firstLine = sample.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").replace(/\r$/, "");
  const delim = detectDelim(firstLine);
  const headers = firstLine.split(delim).map((h, i) => h.replace(/^\uFEFF/, "").trim() || `col_${i}`);
  const map = autoMap(headers, mapping);

  let offset = Math.min(file.size, firstLine.length + 1);
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let stop = false;

  const finish = () => {
    row.push(field);
    field = "";
    scanned++;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    row = [];
    const hit = matchRow(obj, map, index);
    if (hit.matched) {
      matched++;
      if (hit.cpf && index.cpfs.has(hit.cpf)) hits[`cpf:${hit.cpf}`] = hit;
      if (hit.nome && index.nomes.has(hit.nome)) hits[`nome:${hit.nome}`] = hit;
    }
    return Object.values(hits).length > 0 && Object.values(hits).every((h) => h.matched);
  };

  while (offset < file.size && !stop) {
    const end = Math.min(file.size, offset + CHUNK);
    const text = new TextDecoder(encoding).decode(await file.slice(offset, end).arrayBuffer());
    offset = end;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i++;
          } else inQuotes = false;
        } else field += c;
      } else if (c === '"' && !field) inQuotes = true;
      else if (c === delim) {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        if (finish()) {
          stop = true;
          break;
        }
      } else if (c !== "\r") field += c;
    }
  }
  return { scanned, matched };
}

async function enrichFromCsv(file: File, queries: EnrichQuery[], mapping: Record<string, string>, encoding = "utf-8") {
  const index = buildQueryIndex(queries);
  const hits: Record<string, EnrichHit> = {};
  for (const q of queries) {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) hits[`cpf:${d}`] = { matched: false };
    const n = normName(q.nome);
    if (n.length >= 8) hits[`nome:${n}`] = { matched: false };
  }
  if (!Object.keys(hits).length) {
    post("enrich-done", { hits, scanned: 0, matched: 0 });
    return;
  }
  const r = await scanCsvFile(file, index, hits, mapping, encoding);
  post("enrich-done", {
    hits,
    scanned: r.scanned,
    matched: Object.values(hits).filter((h) => h.matched).length,
  });
}

async function enrichFromCsvMulti(files: File[], queries: EnrichQuery[], mapping: Record<string, string>, encoding = "utf-8") {
  const index = buildQueryIndex(queries);
  const hits: Record<string, EnrichHit> = {};
  for (const q of queries) {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) hits[`cpf:${d}`] = { matched: false };
    const n = normName(q.nome);
    if (n.length >= 8) hits[`nome:${n}`] = { matched: false };
  }
  let scanned = 0;
  for (let fi = 0; fi < files.length; fi++) {
    if (Object.keys(hits).length && Object.values(hits).every((h) => h.matched)) break;
    post("enrich-progress", { loaded: fi + 1, total: files.length, phase: "file", scanned });
    const r = await scanCsvFile(files[fi], index, hits, mapping, encoding);
    scanned += r.scanned;
  }
  post("enrich-done", {
    hits,
    scanned,
    matched: Object.values(hits).filter((h) => h.matched).length,
  });
}

async function enrichFromDbFile(file: File, queries: EnrichQuery[], table: string, mapping: Record<string, string>) {
  post("enrich-progress", { loaded: 0, total: 1, phase: "load-db" });
  if (file.size > 450 * 1024 * 1024) {
    throw new Error("DB > 450 MB: use as partes CSV (1351) nesta aba, ou OPFS em Consulta bases.");
  }
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({ locateFile: (f: string) => `https://sql.js.org/dist/${f}` });
  const buf = new Uint8Array(await file.arrayBuffer());
  post("enrich-progress", { loaded: 1, total: 2, phase: "query" });
  const db = new SQL.Database(buf);
  const index = buildQueryIndex(queries);
  const hits: Record<string, EnrichHit> = {};
  for (const q of queries) {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) hits[`cpf:${d}`] = { matched: false };
    const n = normName(q.nome);
    if (n.length >= 8) hits[`nome:${n}`] = { matched: false };
  }
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const names = (tables[0]?.values || []).map((r) => String(r[0]));
  let tname = names.includes(table) ? table : names[0] || table;
  const cpfCol = mapping.cpf || "cpf";
  const nomeCol = mapping.nome || "nome";
  const telCol = mapping.telefone || "telefone";
  const colsInfo = db.exec(`PRAGMA table_info("${tname.replace(/"/g, '""')}")`);
  const colNames = (colsInfo[0]?.values || []).map((r) => String(r[1]));
  const picked = pickColumns(colNames);
  const cpfC = picked.cpf || cpfCol;
  const nomeC = picked.nome || nomeCol;
  const telC = picked.telefone || telCol;

  for (const cpf of index.cpfs) {
    const sql = `SELECT * FROM "${tname.replace(/"/g, '""')}" WHERE REPLACE(REPLACE(REPLACE(CAST("${cpfC.replace(/"/g, '""')}" AS TEXT),'.',''),'-',''),' ','') = ? LIMIT 2`;
    try {
      const stmt = db.prepare(sql);
      stmt.bind([cpf]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        hits[`cpf:${cpf}`] = {
          matched: true,
          match_by: "cpf",
          cpf,
          nome: normName(row[nomeC]),
          telefone: String(row[telC] ?? ""),
        };
      }
      stmt.free();
    } catch {
      /* ignore */
    }
  }
  db.close();
  post("enrich-done", {
    hits,
    scanned: index.cpfs.size,
    matched: Object.values(hits).filter((h) => h.matched).length,
  });
}

async function enrichFromOpfsDetran(queries: EnrichQuery[], table: string, mapping: Record<string, string>) {
  const sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1?.OpfsDb) throw new Error("OPFS indisponível.");
  const db = new sqlite3.oo1.OpfsDb(OPFS_PATH, "r");
  const index = buildQueryIndex(queries);
  const hits: Record<string, EnrichHit> = {};
  for (const q of queries) {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) hits[`cpf:${d}`] = { matched: false };
  }
  const qId = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const cpfCol = mapping.cpf || "cpf";
  const nomeCol = mapping.nome || "nome";
  const telCol = mapping.telefone || "telefone";
  const cpfList = [...index.cpfs];
  for (let i = 0; i < cpfList.length; i += 40) {
    const batch = cpfList.slice(i, i + 40);
    const ph = batch.map(() => "?").join(",");
    try {
      const rows = db.selectObjects(
        `SELECT * FROM ${qId(table)} WHERE REPLACE(REPLACE(REPLACE(CAST(${qId(cpfCol)} AS TEXT),'.',''),'-',''),' ','') IN (${ph}) LIMIT 200`,
        batch
      ) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const cpf = onlyDigits(row[cpfCol]);
        if (cpf.length === 11) {
          hits[`cpf:${cpf}`] = {
            matched: true,
            match_by: "cpf",
            cpf,
            nome: normName(row[nomeCol]),
            telefone: String(row[telCol] ?? ""),
          };
        }
      }
    } catch {
      /* table name may differ */
    }
    post("enrich-progress", { loaded: i + batch.length, total: cpfList.length });
  }
  db.close();
  post("enrich-done", {
    hits,
    scanned: cpfList.length,
    matched: Object.values(hits).filter((h) => h.matched).length,
  });
}

worker.onmessage = async (ev: MessageEvent) => {
  try {
    const m = ev.data;
    if (m.type === "enrich-csv") await enrichFromCsv(m.file, m.queries || [], m.mapping || {}, m.encoding || "utf-8");
    if (m.type === "enrich-csv-multi") await enrichFromCsvMulti(m.files || [], m.queries || [], m.mapping || {}, m.encoding || "utf-8");
    if (m.type === "enrich-db-file") await enrichFromDbFile(m.file, m.queries || [], m.table || "SPT_USERS", m.mapping || {});
    if (m.type === "enrich-detran-opfs") await enrichFromOpfsDetran(m.queries || [], m.table || "SPT_USERS", m.mapping || {});
  } catch (cause) {
    post("error", { message: err(cause) });
  }
};

export {};
