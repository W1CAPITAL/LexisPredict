/**
 * Bridge server-to-server com WA.Auto Cloud.
 * Usa a sessão Supabase já autenticada do LexisPredict como credencial.
 * Nenhuma chave privada do WA.Auto precisa existir no navegador ou no APK.
 */
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type WaAutoHealth = {
  configured: boolean;
  ok: boolean;
  provider: "waauto";
  status?: string | null;
  error?: string;
};

const DEFAULT_WA_AUTO_URL = "https://wa-auto-cloud.onrender.com";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function getWaAutoConfig() {
  const baseUrl = (
    firstEnv("WA_AUTO_URL", "WA_AUTO_BASE_URL", "WA_AUTO_SERVER_URL") ||
    DEFAULT_WA_AUTO_URL
  ).replace(/\/$/, "");
  const integrationToken = firstEnv(
    "WA_AUTO_TOKEN",
    "WA_INTEGRATION_TOKEN",
    "WA_MCP_TOKEN"
  );
  return { baseUrl, integrationToken };
}

export function isWaAutoConfigured() {
  return Boolean(getWaAutoConfig().baseUrl);
}

async function authHeaders(): Promise<Record<string, string>> {
  const { integrationToken } = getWaAutoConfig();
  if (integrationToken) {
    return {
      Authorization: `Bearer ${integrationToken}`,
      "x-wa-integration-token": integrationToken,
      "Content-Type": "application/json",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = String(data?.session?.access_token || "").trim();
  if (!accessToken) throw new Error("Sessão LexisPredict não disponível para o WA.Auto.");

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function readJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
}

export async function waAutoHealth(): Promise<WaAutoHealth> {
  const { baseUrl } = getWaAutoConfig();
  if (!baseUrl) {
    return {
      configured: false,
      ok: false,
      provider: "waauto",
      error: "WA.Auto sem URL configurada",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/status`, {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await readJson(res);
    const status = String(body?.connection?.status || body?.whatsapp || "").toLowerCase();
    return {
      configured: true,
      ok: res.ok && status === "ready",
      provider: "waauto",
      status: status || null,
      error: res.ok ? undefined : String(body?.error || `HTTP ${res.status}`),
    };
  } catch (e: any) {
    return {
      configured: true,
      ok: false,
      provider: "waauto",
      error: e?.message || "WA.Auto indisponível",
    };
  }
}

export async function sendViaWaAuto(to: string, message: string) {
  const { baseUrl } = getWaAutoConfig();
  if (!baseUrl) {
    return { ok: false as const, configured: false, error: "WA.Auto indisponível" };
  }
  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/send`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ to, message }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    const body = await readJson(res);
    if (!res.ok || body?.ok === false) {
      return {
        ok: false as const,
        configured: true,
        error: String(body?.error || `WA.Auto HTTP ${res.status}`),
      };
    }
    return { ok: true as const, configured: true, raw: body, provider: "waauto" as const };
  } catch (e: any) {
    return {
      ok: false as const,
      configured: true,
      error: e?.message || "Falha ao enviar pelo WA.Auto",
    };
  }
}

export async function listWaAutoChats(opts?: { onlyGroups?: boolean; limit?: number }) {
  const { baseUrl } = getWaAutoConfig();
  if (!baseUrl) {
    return { ok: false as const, configured: false, chats: [] as any[], error: "WA.Auto indisponível" };
  }
  try {
    const qs = new URLSearchParams();
    qs.set("limit", String(Math.min(Math.max(opts?.limit || 100, 1), 100)));
    if (opts?.onlyGroups) qs.set("onlyGroups", "1");
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/chats?${qs.toString()}`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const body = await readJson(res);
    if (!res.ok) {
      return { ok: false as const, configured: true, chats: [] as any[], error: String(body?.error || `HTTP ${res.status}`) };
    }
    const chats = (Array.isArray(body?.chats) ? body.chats : []).map((row: any) => ({
      jid: String(row.jid || ""),
      name: String(row.name || row.phone || row.jid || "WhatsApp"),
      isGroup: !!row.is_group,
      lastMessage: String(row.last_message || ""),
    }));
    return { ok: true as const, configured: true, chats, provider: "waauto" as const };
  } catch (e: any) {
    return { ok: false as const, configured: true, chats: [] as any[], error: e?.message || "Falha ao listar chats WA.Auto" };
  }
}

export async function fetchWaAutoChatByJid(jid: string, limit = 80) {
  const { baseUrl } = getWaAutoConfig();
  if (!baseUrl) {
    return { ok: false as const, configured: false, messages: [] as any[], error: "WA.Auto indisponível" };
  }
  try {
    const qs = new URLSearchParams({
      jid,
      limit: String(Math.min(Math.max(limit, 1), 100)),
    });
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/messages?${qs.toString()}`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const body = await readJson(res);
    if (!res.ok) {
      return { ok: false as const, configured: true, messages: [] as any[], error: String(body?.error || `HTTP ${res.status}`) };
    }
    const messages = (Array.isArray(body?.messages) ? body.messages : [])
      .map((m: any) => ({
        id: String(m.id || ""),
        direction: m.is_from_me ? ("out" as const) : ("in" as const),
        body: String(m.content || ""),
        at: String(m.timestamp || new Date().toISOString()),
        source: "waauto",
      }))
      .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { ok: true as const, configured: true, messages, provider: "waauto" as const };
  } catch (e: any) {
    return { ok: false as const, configured: true, messages: [] as any[], error: e?.message || "Falha ao carregar chat WA.Auto" };
  }
}


export async function getWaAutoConnection() {
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/status`, {
      headers: await authHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = await readJson(res);
    if (!res.ok) return { ok: false as const, error: String(body?.error || `HTTP ${res.status}`) };
    return { ok: true as const, connection: body?.connection || null, raw: body };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha ao consultar WA.Auto" };
  }
}

export async function connectWaAuto() {
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/connect`, {
      method: "POST",
      headers: await authHeaders(),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await readJson(res);
    if (!res.ok) return { ok: false as const, error: String(body?.error || `HTTP ${res.status}`) };
    return { ok: true as const, connection: body?.connection || null };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha ao conectar WA.Auto" };
  }
}

export async function pairWaAuto(phone: string) {
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/pair`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ phone }),
      cache: "no-store",
      signal: AbortSignal.timeout(40000),
    });
    const body = await readJson(res);
    if (!res.ok) return { ok: false as const, error: String(body?.error || `HTTP ${res.status}`) };
    return { ok: true as const, connection: body?.connection || null };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha ao parear WA.Auto" };
  }
}

export async function logoutWaAuto() {
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await fetch(`${baseUrl}/api/integrations/lexispredict/logout`, {
      method: "POST",
      headers: await authHeaders(),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await readJson(res);
    if (!res.ok) return { ok: false as const, error: String(body?.error || `HTTP ${res.status}`) };
    return { ok: true as const, connection: body?.connection || null };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha ao desconectar WA.Auto" };
  }
}
