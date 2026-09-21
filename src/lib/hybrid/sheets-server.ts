"use server";

function webhookUrl() {
  return String(process.env.LEXIS_SHEETS_WEBHOOK_URL || process.env.SHEETS_WEBHOOK_URL || "").trim();
}

function token() {
  return String(process.env.LEXIS_SHEETS_TOKEN || process.env.SHEETS_TOKEN || "").trim();
}

export async function sheetsListProcessos(opts?: { limit?: number }) {
  const url = webhookUrl();
  const tok = token();
  if (!url) {
    return { ok: false, error: "LEXIS_SHEETS_WEBHOOK_URL ausente no Vercel", rows: [] as any[] };
  }
  if (!tok) {
    return { ok: false, error: "LEXIS_SHEETS_TOKEN ausente no Vercel", rows: [] as any[] };
  }
  const endpoint = new URL(url);
  endpoint.searchParams.set("action", "list");
  endpoint.searchParams.set("token", tok);
  endpoint.searchParams.set("limit", String(opts?.limit || 8000));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: `Webhook não retornou JSON (${res.status}).`, rows: [] as any[] };
    }
    const rows = json.rows || json.data || json.processos || [];
    if (!json.ok && json.error) {
      return { ok: false, error: String(json.error), rows: Array.isArray(rows) ? rows : [] };
    }
    return { ok: true, error: "", rows: Array.isArray(rows) ? rows : [] };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao ler a planilha", rows: [] as any[] };
  } finally {
    clearTimeout(t);
  }
}
