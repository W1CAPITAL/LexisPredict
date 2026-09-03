/**
 * Cliente server-side do Apps Script.
 * Banco (Supabase) é a fonte operacional; Sheets é apenas espelho incremental/Plano B.
 */
import { HYBRID_SHEETS_ENV } from "./policy";

export type SheetsWriteRow = {
  protocolo: string;
  [key: string]: string | boolean | number | null | undefined | Record<string, unknown>;
};

export type AtendimentoMirrorResult = {
  ok: boolean;
  attempted: boolean;
  reason?: string;
  updated?: number;
  added?: number;
  written?: number;
};

export function buildAtendimentoMirrorRow(input: {
  protocolo: string;
  empresaId: string;
  ultimoRetorno: string;
  proximoPrazo: string | null;
  observacao: string;
  situacao: string;
  actorId?: string | null;
  actorName?: string;
}) : SheetsWriteRow {
  return {
    protocolo: input.protocolo,
    Protocolo: input.protocolo,
    empresa_id: input.empresaId,
    EmpresaId: input.empresaId,
    UltimoRetorno: input.ultimoRetorno,
    Retorno: input.ultimoRetorno,
    ProximoRetorno: input.proximoPrazo,
    Prazo: input.proximoPrazo,
    Observacao: input.observacao,
    Situacao: input.situacao,
    AtendidoPor: input.actorName || input.actorId || null,
    Responsavel: input.actorName || input.actorId || null,
    atendido_por: input.actorId || null,
    edited_by: input.actorId || null,
  };
}

export async function mirrorAtendimento(input: Parameters<typeof buildAtendimentoMirrorRow>[0]): Promise<AtendimentoMirrorResult> {
  if (!sheetsWebhookConfigured()) return { ok: false, attempted: false, reason: "Sheets não configurado." };
  const result = await sheetsWriteRows([buildAtendimentoMirrorRow(input)]);
  return result.ok
    ? { ok: true, attempted: true, updated: result.updated, added: result.added, written: result.written }
    : { ok: false, attempted: true, reason: result.error || "Sheets não confirmou o espelhamento." };
}

function webhookUrl(): string {
  return String(
    process.env[HYBRID_SHEETS_ENV.webhook] || process.env.SHEETS_WEBHOOK_URL || "",
  ).trim().replace(/\/dev(\b|$)/, "/exec");
}

function token(): string {
  return String(process.env[HYBRID_SHEETS_ENV.token] || process.env.SHEETS_TOKEN || "").trim();
}

export function sheetsWebhookConfigured(): boolean {
  const u = webhookUrl();
  return !!u && /^https:\/\/script\.google\.com\//i.test(u);
}

function parseBody(text: string) {
  const slice = text.slice(0, 500);
  if (/<!DOCTYPE html|<html/i.test(slice)) {
    return { ok: false, error: "Webhook Google devolveu HTML; use a implantação /exec do Apps Script." };
  }
  try {
    const json = JSON.parse(text || "{}");
    return { ok: !!(json?.ok ?? true), json };
  } catch {
    return { ok: false, error: "Resposta não-JSON do webhook: " + slice.slice(0, 180) };
  }
}

async function sheetsGet(params: Record<string, string>): Promise<{ ok: boolean; json?: any; error?: string; status?: number }> {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };
  const q = new URLSearchParams({ token: token(), ...params });
  try {
    const res = await fetch(`${url}?${q.toString()}`, { method: "GET", redirect: "follow", cache: "no-store" });
    const parsed = parseBody(await res.text());
    return { ...parsed, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha GET Sheets", status: 0 };
  }
}

async function sheetsPost(body: Record<string, unknown>, timeoutMs = 4500): Promise<{ ok: boolean; json?: any; error?: string; status?: number }> {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };
  if (!token()) return { ok: false, error: "LEXIS_SHEETS_TOKEN não configurado" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8", Accept: "application/json,text/plain,*/*" },
      body: JSON.stringify({ token: token(), ...body }),
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    const parsed = parseBody(await res.text());
    return { ...parsed, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Webhook Sheets excedeu 4,5s." : (e?.message || "Falha POST Sheets"), status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function sheetsServerPost(body: Record<string, unknown>): Promise<{ ok: boolean; json?: any; error?: string; status?: number }> {
  const action = String(body.action || "ping");
  const post = await sheetsPost(body, action === "upsert_batch" ? 4500 : 3500);
  if (post.ok) return post;

  // GET somente para ping/list/get. Nunca convertemos escrita em GET.
  if (action !== "write" && action !== "upsert_batch") {
    const flat: Record<string, string> = { action };
    for (const [k, v] of Object.entries(body)) {
      if (k === "action" || v === undefined || v === null) continue;
      flat[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    const get = await sheetsGet(flat);
    if (get.ok) return get;
  }

  return { ok: false, error: post.error || `Webhook HTTP ${(post as any).status || 0}`, status: (post as any).status };
}

export async function sheetsListProcessos(opts?: {
  empresaId?: string;
  responsavel?: string;
  limit?: number;
}): Promise<{ ok: boolean; rows: any[]; error?: string }> {

  const r = await sheetsServerPost({ action: "list", empresaId: opts?.empresaId, responsavel: opts?.responsavel, limit: opts?.limit ?? 5000 });
  if (!r.ok) return { ok: false, rows: [], error: r.error };
  const rows = r.json?.rows || r.json?.processos || r.json?.data || [];
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

export async function sheetsWriteRows(rows: SheetsWriteRow[]) {
  if (!rows.length) return { ok: true, updated: 0, added: 0, written: 0 };
  const r = await sheetsServerPost({
    action: "upsert_batch",
    rows,
    source: "LexisPredict",
    actor: "sync",
    actor_name: "LexisPredict",
    perfil: "superadmin",
  });
  if (!r.ok) return { ok: false, error: r.error, updated: 0, added: 0, written: 0 };
  return {
    ok: true,
    updated: Number(r.json?.updated ?? 0),
    added: Number(r.json?.added ?? 0),
    written: Number(r.json?.written ?? (Number(r.json?.updated ?? 0) + Number(r.json?.added ?? 0))),
  };
}

export async function sheetsPing() {
  const r = await sheetsGet({ action: "ping", ping: "1" });
  return { ok: r.ok, error: r.error, json: r.json };
}
