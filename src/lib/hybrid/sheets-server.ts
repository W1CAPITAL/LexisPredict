/**
 * Cliente Sheets — Apps Script.
 * Este deployment só responde bem em GET (doGet). POST devolve 405 HTML.
 * Por isso: ping/list/write preferem GET; write grande usa POST text/plain com fallback GET.
 */

import { HYBRID_SHEETS_ENV } from "./policy";

export type SheetsWriteRow = {
  protocolo: string;
  UltimoRetorno?: string;
  ProximoRetorno?: string;
  ultimo_movimento?: string;
  DJEN_Resumo?: string;
  DatajudEncerrado?: string | boolean;
  Cumprimento?: string;
  Observacao?: string;
  AtendidoPor?: string;
  [key: string]: string | boolean | number | undefined;
};

function webhookUrl(): string {
  return String(process.env[HYBRID_SHEETS_ENV.webhook] || process.env.SHEETS_WEBHOOK_URL || "")
    .trim()
    .replace(/\/dev(\b|$)/, "/exec");
}

function token(): string {
  return String(process.env[HYBRID_SHEETS_ENV.token] || process.env.SHEETS_TOKEN || "w1-fase1-2026").trim();
}

export function sheetsWebhookConfigured(): boolean {
  const u = webhookUrl();
  return !!u && /^https:\/\/script\.google\.com\//i.test(u);
}

function parseBody(text: string): { ok: boolean; json?: any; error?: string } {
  const slice = text.slice(0, 300);
  if (/<!DOCTYPE html|<html/i.test(slice)) {
    return {
      ok: false,
      error: "HTML do Google (405/login). Use doGet no script ou reimplante: Qualquer pessoa + /exec",
    };
  }
  try {
    const json = JSON.parse(text);
    return { ok: !!(json?.ok ?? true), json };
  } catch {
    return { ok: false, error: "Resposta não-JSON: " + slice.slice(0, 120) };
  }
}

/** GET — funciona no seu /exec atual */
async function sheetsGet(params: Record<string, string>): Promise<{
  ok: boolean;
  json?: any;
  error?: string;
  status?: number;
}> {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };
  const q = new URLSearchParams({ token: token(), ...params });
  try {
    const res = await fetch(`${url}?${q.toString()}`, {
      method: "GET",
      redirect: "follow",
    });
    const text = await res.text();
    const parsed = parseBody(text);
    return { ...parsed, status: res.status, error: parsed.error };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha GET Sheets" };
  }
}

/** POST text/plain (Apps Script lê postData.contents) */
async function sheetsPostPlain(body: Record<string, unknown>): Promise<{
  ok: boolean;
  json?: any;
  error?: string;
  status?: number;
}> {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: token(), ...body }),
      redirect: "follow",
    });
    const text = await res.text();
    const parsed = parseBody(text);
    return { ...parsed, status: res.status, error: parsed.error };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha POST Sheets" };
  }
}

export async function sheetsServerPost(body: Record<string, unknown>) {
  const action = String(body.action || "ping");
  // 1) tenta POST (se o script tiver doPost)
  const post = await sheetsPostPlain(body);
  if (post.ok) return post;
  // 2) fallback GET (seu deployment atual)
  if (action === "write") {
    const rows = body.rows;
    const payload = typeof rows === "string" ? rows : JSON.stringify(rows || []);
    // Apps Script GET tem limite de URL — manda até 3 linhas por request
    return sheetsGet({
      action: "write",
      rows: payload.slice(0, 1500),
    });
  }
  const flat: Record<string, string> = { action };
  for (const [k, v] of Object.entries(body)) {
    if (k === "action" || v === undefined || v === null) continue;
    if (typeof v === "object") flat[k] = JSON.stringify(v);
    else flat[k] = String(v);
  }
  return sheetsGet(flat);
}

export async function sheetsListProcessos(opts?: {
  empresaId?: string;
  responsavel?: string;
  limit?: number;
}): Promise<{ ok: boolean; rows: any[]; error?: string }> {
  const r = await sheetsServerPost({
    action: "list",
    empresaId: opts?.empresaId,
    responsavel: opts?.responsavel,
    limit: opts?.limit ?? 5000,
  });
  if (!r.ok) return { ok: false, rows: [], error: r.error };
  const rows = r.json?.rows || r.json?.processos || r.json?.data || [];
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

export async function sheetsWriteRows(rows: SheetsWriteRow[]): Promise<{
  ok: boolean;
  updated?: number;
  error?: string;
}> {
  if (!rows.length) return { ok: true, updated: 0 };
  // lotes pequenos (GET URL limit)
  let updated = 0;
  for (let i = 0; i < rows.length; i += 5) {
    const chunk = rows.slice(i, i + 5).map((row) => {
      const out: Record<string, unknown> = { Protocolo: row.protocolo, protocolo: row.protocolo };
      for (const [k, v] of Object.entries(row)) {
        if (k === "protocolo" || v === undefined || v === null || v === "") continue;
        out[k] = v;
      }
      return out;
    });
    const r = await sheetsServerPost({ action: "write", rows: chunk });
    if (!r.ok) return { ok: false, error: r.error, updated };
    updated += Number(r.json?.updated ?? r.json?.inserted ?? chunk.length);
  }
  return { ok: true, updated };
}

export async function sheetsPing(): Promise<{ ok: boolean; error?: string; json?: any }> {
  // GET direto — confirmado no seu /exec
  const r = await sheetsGet({ action: "ping", ping: "1" });
  return { ok: r.ok, error: r.error, json: r.json };
}
