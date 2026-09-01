/**
 * Cliente Sheets no servidor (webhook Apps Script).
 * Usado por actions de sync e scanner — sem localStorage.
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

export async function sheetsServerPost(body: Record<string, unknown>): Promise<{
  ok: boolean;
  json?: any;
  error?: string;
  status?: number;
}> {
  const url = webhookUrl();
  if (!url || !/^https:\/\/script\.google\.com\//i.test(url)) {
    return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL não configurada (Apps Script /exec)" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token(), ...body }),
      // Apps Script pode redirecionar
      redirect: "follow",
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      if (/<html|accounts\.google/i.test(text.slice(0, 200))) {
        return {
          ok: false,
          status: res.status,
          error: "HTML do Google — implantar Web App: Eu + Qualquer pessoa + Nova versão /exec",
        };
      }
      return { ok: false, status: res.status, error: "Resposta não-JSON", json: { raw: text.slice(0, 200) } };
    }
    if (!res.ok && !json?.ok) {
      return { ok: false, status: res.status, error: json?.error || `HTTP ${res.status}`, json };
    }
    return { ok: !!(json?.ok ?? true), json, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha de rede Sheets" };
  }
}

/** Lista processos da planilha (carteira operacional). */
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

/** Grava lote de linhas (M/N + resultado de scan). */
export async function sheetsWriteRows(
  rows: SheetsWriteRow[]
): Promise<{ ok: boolean; updated?: number; error?: string }> {
  if (!rows.length) return { ok: true, updated: 0 };
  const r = await sheetsServerPost({
    action: "write",
    rows: rows.map((row) => {
      const out: Record<string, unknown> = { Protocolo: row.protocolo, protocolo: row.protocolo };
      for (const [k, v] of Object.entries(row)) {
        if (k === "protocolo") continue;
        if (v === undefined || v === null || v === "") continue;
        out[k] = v;
      }
      return out;
    }),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    updated: Number(r.json?.updated ?? r.json?.inserted ?? rows.length),
  };
}

/** Ping do webhook. */
export async function sheetsPing(): Promise<{ ok: boolean; error?: string; json?: any }> {
  const r = await sheetsServerPost({ action: "ping", ping: true });
  return { ok: r.ok, error: r.error, json: r.json };
}
