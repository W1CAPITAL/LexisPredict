/**
 * Evolution API v2 gateway for W1 LexisPredict. No WA.Auto fallback.
 * Authentication, tenant boundaries and instance credentials stay server-side.
 */
import 'server-only';
import { getEvolutionConfig, isEvolutionConfigured, sendTextMessageSafe } from '@/lib/evolution-api';
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';

type Conn = { status: string; message?: string; qr?: string | null; pairingCode?: string | null; account?: { name?: string; phone?: string } | null };
function tenantAllowed(tenant: string) {
  // Evolution instance is shared by one enterprise; prevent cross-tenant access.
  const owner = String(process.env.EVOLUTION_EMPRESA_ID || process.env.LEXIS_HYBRID_EMPRESA_ID || '').trim();
  return Boolean(owner && tenant && tenant === owner);
}
function extractState(raw: any) {
  return String(raw?.instance?.state || raw?.instance?.status || raw?.state || raw?.data?.state || raw?.status || '').toLowerCase();
}
function normalizeQr(value: unknown): string | null {
  const s = String(value || '').trim();
  if (s.startsWith('data:image/png;base64,') || s.startsWith('data:image/jpeg;base64,')) return s;
  if (/^[A-Za-z0-9+/=]{500,}$/.test(s)) return 'data:image/png;base64,' + s;
  return null;
}
function details(raw: any): Pick<Conn,'qr'|'pairingCode'> {
  const data = raw?.data || raw;
  return {
    qr: normalizeQr(data?.base64 || data?.qrcode?.base64 || data?.qr?.base64 || data?.qrCode?.base64),
    pairingCode: data?.pairingCode || data?.pairing_code || data?.qrcode?.pairingCode || null,
  };
}
async function call(path: string, method: 'GET'|'DELETE'='GET') {
  const cfg = getEvolutionConfig();
  if (!isEvolutionConfigured()) return { ok: false as const, error: 'Evolution API sem URL ou chave configurada na Vercel.', status: 503, data: null };
  try {
    const res = await fetch(cfg.baseUrl + path, {
      method, cache: 'no-store', signal: AbortSignal.timeout(18000),
      headers: { apikey: cfg.apiKey, Authorization: 'Bearer ' + cfg.apiKey, Accept: 'application/json' },
    });
    const raw = await res.text().catch(() => '');
    if (/<!doctype\s+html|<html\b|service\s+suspended/i.test(raw.slice(0, 2500)) ||
        res.headers.get('content-type')?.includes('text/html')) {
      return { ok: false as const, error: 'Hospedagem da Evolution indisponível (resposta HTML, HTTP ' + res.status + ').', status: res.status, data: null };
    }
    let data: any = null;
    try { data = JSON.parse(raw); } catch {}
    if (!res.ok || data?.error || !data) {
      return { ok: false as const, error: res.status === 401 || res.status === 403
        ? 'Evolution rejeitou a autenticação. Confira EVOLUTION_API_KEY.'
        : res.status === 404 ? 'Instância Evolution não encontrada. Confira EVOLUTION_INSTANCE.'
        : 'Evolution HTTP ' + res.status + ': ' + String(data?.message || data?.error || 'Servidor não respondeu com JSON').slice(0, 160),
        status: res.status, data: null };
    }
    return { ok: true as const, data, status: res.status, error: '' };
  } catch {
    return { ok: false as const, error: 'Servidor Evolution não respondeu. Verifique se a instância está hospedada e online.', status: 503, data: null };
  }
}
function deny(error: string) {
  return { success: false as const, error, connection: null as Conn | null };
}
async function actor(manager = false) {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id || ctx.isViewer) return { ctx: null, error: 'Faça login com uma conta autorizada.' };
  if (!tenantAllowed(ctx.empresa_id)) return { ctx: null, error: 'Instância Evolution não vinculada a esta empresa.' };
  if (manager && !resolveWaAutoPermissions({cargo:ctx.cargo}).canManage)
    return { ctx: null, error: 'Somente Supervisor, Administrador ou Superadmin pode gerenciar o WhatsApp.' };
  return { ctx, error: '' };
}
export async function evolutionConnection() {
  const { error } = await actor();
  if (error) return deny(error);
  const cfg = getEvolutionConfig();
  const res = await call('/instance/connectionState/' + encodeURIComponent(cfg.instance));
  if (!res.ok) return deny(res.error);
  const state = extractState(res.data);
  const ready = state === 'open' || state === 'connected' || state === 'online';
  return {
    success: true as const,
    connection: {status: ready ? 'ready' : (state || 'offline'),
      message: ready ? 'Sessão WhatsApp conectada pela Evolution API.' : 'Sessão desconectada. Gere o QR Code ou use pareamento.' } as Conn,
  };
}
export async function evolutionConnect(phone?: string) {
  const { error } = await actor(true);
  if (error) return deny(error);
  const cfg = getEvolutionConfig();
  const suffix = phone ? '?number=' + encodeURIComponent(phone) : '';
  const res = await call('/instance/connect/' + encodeURIComponent(cfg.instance) + suffix);
  if (!res.ok) return deny(res.error);
  const connection = details(res.data);
  const state = extractState(res.data);
  const ready = state === 'open' || state === 'connected' || state === 'online';
  return {success: true as const, connection: {status: ready ? 'ready' : 'connecting',
    message: ready ? 'Sessão WhatsApp conectada.' : connection.qr ? 'Escaneie o QR Code com o WhatsApp do aparelho.' : connection.pairingCode ? 'Informe o código no WhatsApp para vincular.' : 'Aguardando QR Code da Evolution. Clique em atualizar se não aparecer.',
    ...connection} as Conn};
}
export async function evolutionPair(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  const n = digits.startsWith('55') ? digits : '55' + digits;
  if (!/^55\d{10,11}$/.test(n)) return deny('Informe DDD + número válido.');
  return evolutionConnect(n);
}
export async function evolutionLogout() {
  const { error } = await actor(true);
  if (error) return deny(error);
  const cfg=getEvolutionConfig();
  const res=await call('/instance/logout/' + encodeURIComponent(cfg.instance), 'DELETE');
  if (!res.ok) return deny(res.error);
  return {success:true as const,connection:{status:'offline',message:'Desconectado da Evolution.'} as Conn};
}
type OwnerResult = {ok:true; raw:any; rejected?:false;httpStatus?:number} |
  {ok:false;rejected:boolean;httpStatus?:number;error:string;raw?:unknown};
export async function evolutionForOwner(_ownerId:string,_tenantId:string,_to?:string,_message?:string):Promise<OwnerResult>{
 return {ok:false,rejected:true,httpStatus:503,error:'Automação de WhatsApp suspensa até configurar um provedor oficial.'};
}
export function evolutionDelivered(raw: unknown): boolean {
  if(!raw || typeof raw!=='object') return false;
  const data=raw as any;
  const samples=[data,data?.message,data?.data,data?.result].filter(Boolean);
  return samples.some((v:any)=>{
    const ack=Number(v?.ack ?? v?.messageAck ?? v?.deliveryAck);
    return (Number.isFinite(ack)&&ack>=3) || v?.delivered===true || v?.deliveryConfirmed===true ||
      ['delivered','read','played'].includes(String(v?.deliveryStatus||'').toLowerCase());
  });
}
