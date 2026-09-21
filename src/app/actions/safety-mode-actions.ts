"use server";

import { sheetsAuthLogin, sheetsWebhookConfigured, sheetsPing, sheetsWriteRows } from "@/lib/hybrid/sheets-server";
import { isQuotaOrBillingError } from "@/lib/hybrid/safety-mode";

export async function probeSupabaseAction() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  if (!url) return { ok: false, safety: true, reason: "Supabase sem URL" };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      cache: "no-store",
      headers: { apikey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") },
      signal: AbortSignal.timeout(4000),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok || isQuotaOrBillingError(text) || res.status === 402 || res.status === 429) {
      return { ok: false, safety: true, reason: text.slice(0, 180) || `HTTP ${res.status}` };
    }
    return { ok: true, safety: false };
  } catch (e: any) {
    return { ok: false, safety: true, reason: e?.message || "Supabase inacessível" };
  }
}

export async function safetyLoginAction(usuario: string, senha: string) {
  if (!sheetsWebhookConfigured()) {
    return { ok: false, error: "Webhook da planilha não configurado (LEXIS_SHEETS_WEBHOOK_URL)." };
  }
  const login = String(usuario || "").trim();
  if (!login || !senha) return { ok: false, error: "Informe usuário e senha." };
  const auth = await sheetsAuthLogin(login, senha);
  if (!auth.ok) return { ok: false, error: auth.error };
  return {
    ok: true,
    safety: true,
    token: auth.token,
    user: auth.user,
  };
}

export async function safetyReplayQueueAction(rows: Array<Record<string, unknown>>) {
  if (!Array.isArray(rows) || !rows.length) return { ok: true, written: 0 };
  const mapped = rows.map((row) => ({
    protocolo: String((row as any).protocolo || (row as any).Protocolo || ""),
    ...row,
  })).filter((r) => r.protocolo);
  const wr = await sheetsWriteRows(mapped as any);
  return { ok: wr.ok, written: wr.written || 0, error: wr.error };
}

export async function safetyPingSheetsAction() {
  if (!sheetsWebhookConfigured()) return { ok: false, error: "Webhook ausente" };
  const p = await sheetsPing();
  return { ok: p.ok, error: p.error };
}
