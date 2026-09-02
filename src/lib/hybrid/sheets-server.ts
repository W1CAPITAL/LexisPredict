/**
 * Cliente Sheets / Apps Script.
 * POST é o caminho primário porque suporta lote e preserva a linha inteira.
 * GET continua disponível para ping/list e para compatibilidade com deployments antigos.
 */
import { HYBRID_SHEETS_ENV } from "./policy";

export type SheetsWriteRow = {
  protocolo: string;
  [key: string]: string | boolean | number | null | undefined | Record<string, unknown>;
};

function webhookUrl(): string {
  return String(
    process.env[HYBRID_SHEETS_ENV.webhook] || process.env.SHEETS_WEBHOOK_URL || "",
  )
    .trim()
    .replace(/\/dev(\b|$)/, "/exec");
}

function token(): string {
  return String(
    process.env[HYBRID_SHEETS_ENV.token] || process.env.SHEETS_TOKEN || "w1-fase1-2026",
  ).trim();
}

export function sheetsWebhookConfigured(): boolean {
  const u = webhookUrl();
  return !!u && /^https:\/\/script\.google\.com\//i.test(u);
}

function parseBody(text: string): { ok: boolean; json?: any; error?: string } {
  const slice = text.slice(0, 500);
  if (/<!DOCTYPE html|<html/i.test(slice)) {
    return {
      ok: false,
      error:
        "Webhook do Google devolveu HTML. Verifique a implantação do Apps Script como Aplicativo da Web, acesso 'Qualquer pessoa' e URL /exec.",
    };
  }

  try {
    const json = JSON.parse(text);
    return { ok: !!(json?.ok ?? true), json };
  } catch {
    return { ok: false, error: "Resposta não-JSON do webhook: " + slice.slice(0, 180) };
  }
}

async function sheetsGet(params: Record<string, string>) {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };

  const q = new URLSearchParams({ token: token(), ...params });
  try {
    const res = await fetch(`${url}?${q.toString()}`, { method: "GET", redirect: "follow", cache: "no-store" });
    const text = await res.text();
    const parsed = parseBody(text);
    return { ...parsed, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha GET Sheets" };
  }
}

async function sheetsPost(body: Record<string, unknown>) {
  const url = webhookUrl();
  if (!url) return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL vazia" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        Accept: "application/json,text/plain,*/*",
      },
      body: JSON.stringify({ token: token(), ...body }),
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    const parsed = parseBody(text);
    return { ...parsed, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha POST Sheets" };
  }
}

export async function sheetsServerPost(body: Record<string, unknown>) {
  const action = String(body.action || "ping");

  // POST é obrigatório para escrita real em lote.
  const post = await sheetsPost(body);
  if (post.ok) return post;

  // GET só é usado para operações sem payload grande. Não truncamos uma escrita
  // para 1.500 caracteres, pois isso causa perda/corrupção de dados.
  if (action !== "write" && action !== "upsert_batch") {
    const flat: Record<string, string> = { action };
    for (const [k, v] of Object.entries(body)) {
      if (k === "action" || v === undefined || v === null) continue;
      flat[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
    const get = await sheetsGet(flat);
    if (get.ok) return get;
  }

  return {
    ok: false,
    error: post.error || `Webhook HTTP ${post.status || 0}`,
    status: post.status,
  };
}

export async function sheetsListProcessos(opts?: {
  empresaId?: string;
  responsavel?: string;
  limit?: number;
}) {
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

export async function sheetsWriteRows(rows: SheetsWriteRow[]) {
  if (!rows.length) return { ok: true, updated: 0 };

  const r = await sheetsServerPost({
    action: "write",
    rows,
    source: "LexisPredict",
  });

  if (!r.ok) return { ok: false, error: r.error, updated: 0 };
  return {
    ok: true,
    updated: Number(r.json?.updated ?? r.json?.inserted ?? rows.length),
  };
}

export async function sheetsPing() {
  const r = await sheetsGet({ action: "ping", ping: "1" });
  return { ok: r.ok, error: r.error, json: r.json };
}
