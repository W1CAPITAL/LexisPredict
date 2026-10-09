/**
 * Bridge server-to-server com WA.Auto Cloud.
 * Usa a sessão Supabase já autenticada do LexisPredict como credencial.
 * Nenhuma chave privada do WA.Auto precisa existir no navegador ou no APK.
 */
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';

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

async function authHeaders(forceUserJwt = false): Promise<Record<string, string>> {
  // WA.Auto Cloud requires x-lexis-user-id when a shared integration token
  // is used; without it every status/connect/send call returns HTTP 400.
  // Resolve the identity from verified Supabase server auth, NEVER from an
  // arbitrary client argument or a raw browser-provided header.
  const { getUserContext } = await import('@/lib/server-db');
  const ctx = await getUserContext();
  if (!ctx.auth_id || (!ctx.empresa_id && !ctx.isSuperAdmin) || ctx.isViewer) {
    throw new Error('Sessão LexisPredict sem permissão para conectar ao WA.Auto.');
  }

  const { integrationToken } = getWaAutoConfig();
  if (integrationToken && !forceUserJwt) {
    return {
      Authorization: `Bearer ${integrationToken}`,
      "x-wa-integration-token": integrationToken,
      "x-lexis-user-id": String(ctx.auth_id),
      "Content-Type": "application/json",
    };
  }

  const supabase = await createSupabaseServerClient();
  let { data } = await supabase.auth.getSession();
  let session = data?.session || null;

  const expiresAtMs = Number(session?.expires_at || 0) * 1000;
  const needsRefresh =
    !session?.access_token ||
    !expiresAtMs ||
    expiresAtMs <= Date.now() + 60_000;

  if (needsRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data?.session || session;
  }

  if (session?.access_token) {
    const verified = await supabase.auth.getUser(session.access_token);
    if (verified.error || !verified.data?.user) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data?.session || null;
    }
  }

  const accessToken = String(session?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Sessão LexisPredict expirada. Entre novamente para usar o WA.Auto.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * Primary service-token authentication is bound to a verified user ID.
 * If WA.Auto reports HTTP 401 (e.g. integrations configured with different
 * tokens), retry once with the verified Supabase JWT supported by WA.Auto.
 * Never retry POSTs after a success or ambiguous network failure.
 */
async function waAutoFetch(url: string, init: RequestInit): Promise<Response> {
  const first = await fetch(url, { ...init, headers: await authHeaders() });
  if (first.status !== 401 || !getWaAutoConfig().integrationToken) return first;
  const jwtHeaders = await authHeaders(true);
  return fetch(url, { ...init, headers: jwtHeaders });
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
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/status`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(16000),
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

/**
 * Um HTTP 200 do WA.Auto confirma apenas aceite pela ponte, nao que a mensagem
 * foi recebida/decifrada no WhatsApp do destinatario. Sem comprovante de entrega
 * retornado pelo provedor, campanhas nunca podem registrar "sent".
 */
export function waAutoDeliveryConfirmed(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, any>;
  const candidates = [obj, obj.data, obj.message, obj.result, obj.raw].filter(
    (x): x is Record<string, any> => !!x && typeof x === 'object'
  );
  return candidates.some((v) => {
    const ack = v.ack ?? v.messageAck ?? v.deliveryAck;
    return (typeof ack === 'number' && ack >= 3) ||
      v.delivered === true || v.deliveryConfirmed === true ||
      ['delivered','read','played'].includes(String(v.deliveryStatus || '').toLowerCase());
  });
}

export async function sendViaWaAuto(to: string, message: string) {
  const { baseUrl } = getWaAutoConfig();
  if (!baseUrl) {
    return { ok: false as const, configured: false, error: "WA.Auto indisponível" };
  }
  try {
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/send`, {
      method: "POST",
      body: JSON.stringify({ to, message }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    const body = await readJson(res);
    if (!res.ok || body?.ok === false) {
      return {
        ok: false as const,
        configured: true, rejected: res.status>=400 && res.status<500, httpStatus:res.status,
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
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/chats?${qs.toString()}`, {
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
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/messages?${qs.toString()}`, {
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
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(16000),
    });
    const body = await readJson(res);
    if (!res.ok) return { ok: false as const, error: String(body?.error || `HTTP ${res.status}`) };
    return { ok: true as const, connection: body?.connection || null, raw: body };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Falha ao consultar WA.Auto" };
  }
}

async function checkWaAutoSessionManagement(): Promise<string | null> {
  const { getUserContext } = await import('@/lib/server-db');
  const ctx = await getUserContext();
  if (!ctx.auth_id) return 'Sessão LexisPredict expirada. Faça login novamente.';
  const { canManage } = resolveWaAutoPermissions({ cargo: ctx.cargo });
  if (!canManage) return 'Somente Supervisor, Administrador ou Superadmin pode gerenciar a sessão do WhatsApp.';
  return null;
}

export async function connectWaAuto() {
  try {
    const denial = await checkWaAutoSessionManagement();
    if (denial) return { ok: false as const, error: denial };
  } catch {
    return { ok: false as const, error: 'Não foi possível verificar seu cargo. Entre novamente.' };
  }
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/connect`, {
      method: "POST",
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
  try {
    const denial = await checkWaAutoSessionManagement();
    if (denial) return { ok: false as const, error: denial };
  } catch {
    return { ok: false as const, error: 'Não foi possível verificar seu cargo. Entre novamente.' };
  }
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/pair`, {
      method: "POST",
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
  try {
    const denial = await checkWaAutoSessionManagement();
    if (denial) return { ok: false as const, error: denial };
  } catch {
    return { ok: false as const, error: 'Não foi possível verificar seu cargo. Entre novamente.' };
  }
  const { baseUrl } = getWaAutoConfig();
  try {
    const res = await waAutoFetch(`${baseUrl}/api/integrations/lexispredict/logout`, {
      method: "POST",
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

/** Already-authorized background identity; never accepts identity from a browser argument. */
/**
 * WA.Auto Cloud expects the shared integration token plus x-lexis-user-id.
 * The older lexishwa1 HMAC credential is not accepted by its integration
 * middleware and caused every server-side queue send to return HTTP 401.
 * Caller resolves company ownership and management permission before here.
 */
export async function waAutoForOwner(userId:string,empresaId:string,to?:string,message?:string) {
  const cfg=getWaAutoConfig();
  const validId=/^[0-9a-f-]{36}$/i;
  if(!validId.test(userId)||!validId.test(empresaId))return {
    ok:false as const,rejected:true,httpStatus:403,error:'Responsável pela sessão não identificado.'
  };
  if(!cfg.integrationToken)return {
    ok:false as const,rejected:true,httpStatus:503,
    error:'WA_INTEGRATION_TOKEN não configurado no LexisPredict para envios do servidor.'
  };
  try {
    const response=await fetch(cfg.baseUrl+'/api/integrations/lexispredict/'+(to?'send':'status'),{
      method:to?'POST':'GET',
      headers:{
        Authorization:'Bearer '+cfg.integrationToken,
        'x-wa-integration-token':cfg.integrationToken,
        'x-lexis-user-id':userId,
        'Content-Type':'application/json',
      },
      ...(to?{body:JSON.stringify({to,message})}:{}),
      cache:'no-store',
      signal:AbortSignal.timeout(to?40000:12000),
    });
    const body=await readJson(response);
    if(!response.ok||body?.ok===false)return {
      ok:false as const,rejected:response.status>=400&&response.status<500,
      httpStatus:response.status,
      error:response.status===401
        ? 'WA.Auto rejeitou a credencial do servidor (HTTP 401). Confira WA_INTEGRATION_TOKEN em ambas as plataformas; a campanha foi bloqueada.'
        : String(body?.error||'WA.Auto HTTP '+response.status),raw:body,
    };
    if(!to && body?.connection?.status!=='ready')return {
      ok:false as const,rejected:true,httpStatus:409,
      error:'WhatsApp do responsável desconectado no WA.Auto.',raw:body,
    };
    return {ok:true as const,raw:body};
  }catch(e:any){return {ok:false as const,rejected:false,error:String(e?.message||'WA.Auto indisponível')};}
}
