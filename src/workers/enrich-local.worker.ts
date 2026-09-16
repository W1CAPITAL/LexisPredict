/// <reference lib="webworker" />

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { buildQueryIndex, matchRow, onlyDigits, normName, type EnrichHit, type EnrichQuery } from "../lib/enrich-local-base";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const OPFS_PATH = "/lexispredict/detran-local.sqlite3";
const CHUNK = 2 * 1024 * 1024;

function post(type: string, payload: Record<string, unknown> = {}) {
  worker.postMessage({ type, ...payload });
}

function err(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || "Erro");
}

async function enrichFromCsv(file: File, queries: EnrichQuery[], mapping: Record<string, string>, encoding = "utf-8") {
  const index = buildQueryIndex(queries);
  if (!index.cpfs.size && !index.nomes.size) {
    post("enrich-done", { hits: {} as Record<string, EnrichHit>, scanned: 0 });
    return;
  }
  const hits: Record<string, EnrichHit> = {};
  // key = cpf or nome from query
  const keyFor = (q: EnrichQuery) => {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) return `cpf:${d}`;
    return `nome:${normName(q.nome)}`;
  };
  for (const q of queries) hits[keyFor(q)] = { matched: false };

  const sample = new TextDecoder(encoding).decode(await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer());
  const firstLine = sample.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").replace(/\r$/, "");
  const delim = firstLine.includes(";") && firstLine.split(";").length >= firstLine.split(",").length ? ";" : ",";
  const headers = firstLine.split(delim).map((h, i) => h.replace(/^\uFEFF/, "").trim() || `col_${i}`);
  const map = {
    cpf: mapping.cpf && headers.includes(mapping.cpf) ? mapping.cpf : headers.find((h) => /cpf/i.test(h)) || "",
    nome: mapping.nome && headers.includes(mapping.nome) ? mapping.nome : headers.find((h) => /nome/i.test(h)) || "",
    telefone: mapping.telefone && headers.includes(mapping.telefone) ? mapping.telefone : headers.find((h) => /tel|celular|fone|whats/i.test(h)) || "",
    email: mapping.email && headers.includes(mapping.email) ? mapping.email : headers.find((h) => /e-?mail/i.test(h)) || "",
  };

  let offset = firstLine.length + 1;
  let carry = "";
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let scanned = 0;
  let matched = 0;

  const finish = () => {
    row.push(field);
    field = "";
    scanned++;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = row[i] || ""));
    row = [];
    const hit = matchRow(obj, map, index);
    if (hit.matched) {
      matched++;
      if (hit.cpf && index.cpfs.has(hit.cpf)) hits[`cpf:${hit.cpf}`] = hit;
      if (hit.nome && index.nomes.has(hit.nome)) hits[`nome:${hit.nome}`] = hit;
    }
    // early exit if all queries matched
    return Object.values(hits).every((h) => h.matched);
  };

  while (offset < file.size) {
    const end = Math.min(file.size, offset + CHUNK);
    const text = new TextDecoder(encoding).decode(await file.slice(offset, end).arrayBuffer());
    offset = end;
    const chunk = carry + text;
    carry = "";
    let stop = false;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < chunk.length && chunk[i + 1] === '"') {
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
    post("enrich-progress", { loaded: offset, total: file.size, scanned, matched });
    if (stop) break;
  }

  post("enrich-done", { hits, scanned, matched });
}

async function enrichFromOpfsDetran(
  queries: EnrichQuery[],
  table: string,
  mapping: Record<string, string>
) {
  const sqlite3 = await sqlite3InitModule();
  if (!sqlite3.oo1?.OpfsDb) throw new Error("OPFS indisponível — abra o DETRAN antes em Consulta bases.");
  const db = new sqlite3.oo1.OpfsDb(OPFS_PATH, "r");
  const index = buildQueryIndex(queries);
  const hits: Record<string, EnrichHit> = {};
  for (const q of queries) {
    const d = onlyDigits(q.cpf);
    if (d.length === 11) hits[`cpf:${d}`] = { matched: false };
    else if (normName(q.nome).length >= 8) hits[`nome:${normName(q.nome)}`] = { matched: false };
  }

  const qId = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const cpfCol = mapping.cpf || "cpf";
  const nomeCol = mapping.nome || "nome";
  const telCol = mapping.telefone || "telefone";

  // CPF batch
  const cpfList = [...index.cpfs];
  for (let i = 0; i < cpfList.length; i += 40) {
    const batch = cpfList.slice(i, i + 40);
    const placeholders = batch.map(() => "?").join(",");
    const sql = `SELECT * FROM ${qId(table)} WHERE REPLACE(REPLACE(REPLACE(CAST(${qId(cpfCol)} AS TEXT),'.',''),'-',''),' ','') IN (${placeholders}) LIMIT 200`;
    try {
      const rows = db.selectObjects(sql, batch) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const cpf = onlyDigits(row[cpfCol]);
        const nome = normName(row[nomeCol]);
        const tel = String(row[telCol] ?? "");
        if (cpf.length === 11) {
          hits[`cpf:${cpf}`] = { matched: true, match_by: "cpf", cpf, nome, telefone: tel };
        }
      }
    } catch (e) {
      post("log", { message: err(e) });
    }
    post("enrich-progress", { loaded: i + batch.length, total: cpfList.length, phase: "cpf" });
  }

  // Nome exact for unmatched
  for (const q of queries) {
    const n = normName(q.nome);
    const d = onlyDigits(q.cpf);
    if (d.length === 11 && hits[`cpf:${d}`]?.matched) continue;
    if (n.length < 8) continue;
    if (hits[`nome:${n}`]?.matched) continue;
    try {
      const rows = db.selectObjects(
        `SELECT * FROM ${qId(table)} WHERE UPPER(CAST(${qId(nomeCol)} AS TEXT)) = ? LIMIT 5`,
        [n]
      ) as Array<Record<string, unknown>>;
      if (rows[0]) {
        const row = rows[0];
        hits[`nome:${n}`] = {
          matched: true,
          match_by: "nome",
          nome: n,
          cpf: onlyDigits(row[cpfCol]) || undefined,
          telefone: String(row[telCol] ?? ""),
        };
      }
    } catch {
      /* col names may differ — user maps in UI */
    }
  }

  db.close();
  post("enrich-done", { hits, scanned: cpfList.length, matched: Object.values(hits).filter((h) => h.matched).length });
}

worker.onmessage = async (ev: MessageEvent) => {
  try {
    const m = ev.data;
    if (m.type === "enrich-csv") await enrichFromCsv(m.file, m.queries || [], m.mapping || {}, m.encoding);
    if (m.type === "enrich-detran-opfs") await enrichFromOpfsDetran(m.queries || [], m.table || "SPT_USERS", m.mapping || {});
  } catch (cause) {
    post("error", { message: err(cause) });
  }
};

export {};
