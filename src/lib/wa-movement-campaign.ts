/**
 * WA Auto movement alerts. Only stored, dated DataJud/DJEN facts are sent.
 * One campaign per company, one delivery per process+event, atomic DB claims.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';
import { getWaAutoConfig, waAutoHealth } from '@/lib/wa-auto-client';
import { persistWhatsAppMessage } from '@/lib/whatsapp-persist';

type SourceRow = {
  id: number; empresa_id: string; cliente?: string | null; telefone?: string | null;
  protocolo_ref?: string | null; datajud_ultimo_movimento?: string | null;
  datajud_ultimo_nome?: string | null; djen_ultima_data?: string | null;
  djen_ultimo_resumo?: string | null; dados?: Record<string, unknown> | null;
};
type Alert = {
  empresa_id: string; processo_id: number; protocolo: string; phone: string;
  client_name: string; source: 'DataJud' | 'DJEN'; event_at: string;
  event_hash: string; message: string;
};
const TRUE = new Set(['1','true','sim','s','yes']);
const negative = (v: unknown) => v === false || (typeof v === 'string' && ['false','não','nao','0','no'].includes(v.trim().toLowerCase()));
const affirmative = (v: unknown) => v === true || TRUE.has(String(v ?? '').trim().toLowerCase());
function phoneOf(v: unknown) {
  let digits = String(v || '').replace(/\D/g,'');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}
function eventTime(v: unknown): number {
  if (!v) return 0;
  const raw = String(v).trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= Date.UTC(2000,0,1) && ms < Date.now() + 86400000 ? ms : 0;
}
function normalizedText(v: unknown): string {
  return String(v || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
}
export function prepareMovementAlert(row: SourceRow):
  { alert: Alert | null; reason: 'blocked'|'phone'|'event'|'ok' } {
  const meta = (row.dados && typeof row.dados === 'object') ? row.dados : {};
  const flags = ['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout','bloquear_whatsapp','naoEnviarWhatsapp'];
  const consent = ['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'];
  if (flags.some(k => affirmative(meta[k])) || consent.some(k => k in meta && negative(meta[k]))) {
    return { alert: null, reason: 'blocked' };
  }
  const phone = phoneOf(row.telefone || meta.telefone || meta.TELEFONE);
  if (!phone) return { alert: null, reason: 'phone' };
  const datajud = { source: 'DataJud' as const, date: eventTime(row.datajud_ultimo_movimento), text: normalizedText(row.datajud_ultimo_nome) };
  const djen = { source: 'DJEN' as const, date: eventTime(row.djen_ultima_data), text: normalizedText(row.djen_ultimo_resumo) };
  const chosen = [datajud,djen].filter(e => e.date && e.text).sort((a,b) => b.date - a.date)[0];
  const cnj = String(row.protocolo_ref || meta.protocolo || '').trim();
  if (!chosen || !cnj) return { alert: null, reason: 'event' };
  const name = normalizedText(row.cliente || meta.cliente || meta.CLIENTE || 'Cliente').slice(0,100);
  const when = new Date(chosen.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const message = `Olá, ${name}. Informamos que o processo nº ${cnj} registra a seguinte movimentação em ${when} (fonte: ${chosen.source}):\n\n${chosen.text}\n\nEsta mensagem informa o registro processual e não significa decisão favorável ou desfavorável. Se precisar de esclarecimentos, responda a esta conversa.\nEquipe de acompanhamento processual.`;
  const fingerprint = [row.empresa_id,row.id,chosen.source,chosen.date,chosen.text].join('|');
  return {
    reason: 'ok',
    alert: {
      empresa_id: row.empresa_id, processo_id: Number(row.id), protocolo: cnj,
      phone, client_name: name, source: chosen.source,
      event_at: new Date(chosen.date).toISOString(),
      event_hash: createHash('sha256').update(fingerprint).digest('hex'), message,
    },
  };
}

async function requireManager() {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id || ctx.isViewer ||
      !resolveWaAutoPermissions({cargo: ctx.cargo}).canManage) {
    throw new Error('Somente Supervisor, Administrador ou Superadmin vinculado à empresa pode enviar avisos da carteira.');
  }
  return ctx as typeof ctx & { auth_id: string; empresa_id: string };
}

async function collectPortfolio(empresaId: string) {
  const db = await getSupabaseAdmin();
  const entries: Alert[] = [];
  const counts = { scanned: 0, withoutPhone: 0, withoutEvent: 0, blocked: 0, samePhone: 0 };
  const seen = new Set<string>();
  // Supabase caps the number of records per request. Pagination covers the entire company.
  for (let offset=0; offset<100000; offset+=400) {
    const {data,error} = await db.from('processos')
      .select('id,empresa_id,cliente,telefone,protocolo_ref,datajud_ultimo_movimento,datajud_ultimo_nome,djen_ultima_data,djen_ultimo_resumo,dados')
      .eq('empresa_id',empresaId).order('id',{ascending:true}).range(offset,offset+399);
    if (error) throw new Error('Carteira: ' + error.message);
    const rows = (data || []) as SourceRow[];
    for (const row of rows) {
      counts.scanned++;
      const result = prepareMovementAlert(row);
      if (!result.alert) {
        if (result.reason==='phone') counts.withoutPhone++;
        else if (result.reason==='blocked') counts.blocked++;
        else counts.withoutEvent++;
        continue;
      }
      const key = result.alert.processo_id + ':' + result.alert.event_hash;
      if (seen.has(key)) { counts.samePhone++; continue; }
      seen.add(key);
      entries.push(result.alert);
    }
    if (rows.length < 400) break;
  }
  return { entries, counts };
}

export async function previewMovementCampaign() {
  try {
    const ctx = await requireManager();
    const { entries, counts } = await collectPortfolio(ctx.empresa_id);
    const db = await getSupabaseAdmin();
    // Preview excludes already queued/sent versions (database uniqueness also guards races).
    const {data,error} = await db.from('wa_movement_dispatches')
      .select('processo_id,event_hash').eq('empresa_id',ctx.empresa_id).limit(100000);
    if (error) throw new Error('Fila não instalada no Supabase. Aplique a migração: ' + error.message);
    const prior = new Set((data || []).map(x => x.processo_id + ':' + x.event_hash));
    const pending = entries.filter(x => !prior.has(x.processo_id + ':' + x.event_hash));
    return {
      ok: true as const, counts: { ...counts, alreadyQueued: entries.length - pending.length, eligible: pending.length },
      samples: pending.slice(0,5).map(x => ({ client: x.client_name, cnj: x.protocolo, source: x.source, date: x.event_at, message: x.message })),
    };
  } catch (e: any) {
    return {ok:false as const,error:String(e?.message||e)};
  }
}

export async function createMovementCampaign(confirmed: boolean) {
  try {
    const ctx=await requireManager();
    if (confirmed !== true) throw new Error('Confirme previamente a autorização dos contatos de acompanhamento.');
    const health = await waAutoHealth();
    if (!health.ok) throw new Error('Conecte o WA.Auto antes de iniciar. ' + (health.error || 'Sessão indisponível'));
    const db=await getSupabaseAdmin();
    const {data: existing} = await db.from('wa_movement_campaigns').select('id')
      .eq('empresa_id',ctx.empresa_id).eq('status','running').limit(1);
    if (existing?.length) throw new Error('Já existe uma campanha ativa desta empresa. Pause ou conclua antes de criar outra.');

    const {entries}=await collectPortfolio(ctx.empresa_id);
    if (!entries.length) throw new Error('Nenhum processo com telefone válido e movimentação identificada.');
    const {data: campaign,error: createErr} = await db.from('wa_movement_campaigns')
      .insert({ empresa_id:ctx.empresa_id,owner_auth_id:ctx.auth_id,consent_attested:true,status:'running' })
      .select('id').single();
    if (createErr || !campaign) throw new Error(createErr?.message || 'Não foi possível criar a campanha.');
    let inserted=0;
    try {
      for(let offset=0;offset<entries.length;offset+=150) {
        const values=entries.slice(offset,offset+150).map(x=>({...x,campaign_id:campaign.id}));
        const {data,error}=await db.from('wa_movement_dispatches').upsert(values,{
          onConflict:'empresa_id,processo_id,event_hash',ignoreDuplicates:true,
        }).select('id');
        if(error) throw new Error(error.message);
        inserted+=(data||[]).length;
      }
      await db.from('wa_movement_campaigns').update({total:inserted}).eq('id',campaign.id).eq('empresa_id',ctx.empresa_id);
      if(!inserted) {
        await db.from('wa_movement_campaigns').update({status:'completed'}).eq('id',campaign.id);
        throw new Error('Todos os movimentos já estavam na fila ou já foram enviados. Não serão duplicados.');
      }
      return {ok:true as const,campaignId:String(campaign.id),total:inserted};
    } catch(error) {
      await db.from('wa_movement_campaigns').update({status:'paused'}).eq('id',campaign.id);
      throw error;
    }
  } catch(e:any) {
    return {ok:false as const,error:String(e?.message||e)};
  }
}

export async function getMovementCampaign() {
  try {
    const ctx=await requireManager();
    const db=await getSupabaseAdmin();
    const {data,error}=await db.from('wa_movement_campaigns')
      .select('id,status,total,sent_count,failed_count,uncertain_count,next_send_at,created_at')
      .eq('empresa_id',ctx.empresa_id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error) throw error;
    return {ok:true as const,campaign:data};
  } catch(e:any) {return {ok:false as const,error:String(e?.message||e)};}
}

export async function changeMovementCampaign(id:string, action:'pause'|'resume'|'cancel') {
  try {
    const ctx=await requireManager();
    const db=await getSupabaseAdmin();
    const {data:campaign,error}=await db.from('wa_movement_campaigns')
      .select('id,status,owner_auth_id').eq('empresa_id',ctx.empresa_id).eq('id',id).single();
    if(error||!campaign) throw new Error('Campanha não encontrada nesta empresa.');
    if(action==='resume' && campaign.status!=='paused') throw new Error('Só é possível retomar campanhas pausadas.');
    if(action==='resume') {
      const {data:other}=await db.from('wa_movement_campaigns').select('id')
        .eq('empresa_id',ctx.empresa_id).eq('status','running').neq('id',id).limit(1);
      if(other?.length) throw new Error('Outra campanha já está ativa.');
    }
    if(action!=='resume' && campaign.status!=='running' && campaign.status!=='paused') throw new Error('Campanha já finalizada.');
    const newStatus= action==='resume'?'running':action==='pause'?'paused':'cancelled';
    const {error:changeError}=await db.from('wa_movement_campaigns')
      .update({status:newStatus,next_send_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      .eq('empresa_id',ctx.empresa_id).eq('id',id);
    if(changeError) throw changeError;
    if(action==='cancel') await db.from('wa_movement_dispatches').update({status:'cancelled'})
      .eq('empresa_id',ctx.empresa_id).eq('campaign_id',id).eq('status','pending');
    return {ok:true as const};
  } catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}

export async function deliverNextMovement(options: { campaignId?: string; verifiedOwner?: string } = {}) {
  const db=await getSupabaseAdmin();
  const {data,error}=await db.rpc('wa_claim_movement',{p_campaign:options.campaignId || null});
  if(error) return {ok:false as const,error:error.message};
  const claimed=(data||[])[0] as (Alert & {id:string;campaign_id:string})|undefined;
  if(!claimed) return {ok:true as const,processed:false as const};
  const {data:campaign}=await db.from('wa_movement_campaigns')
    .select('id,empresa_id,owner_auth_id,status').eq('id',claimed.campaign_id).single();
  if(!campaign || campaign.empresa_id!==claimed.empresa_id || campaign.status!=='running') {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Campanha indisponível'});
    return {ok:false as const,error:'Campanha não está ativa'};
  }
  if(options.verifiedOwner && campaign.owner_auth_id!==options.verifiedOwner) {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'uncertain',p_error:'Sessão do operador não corresponde à campanha'});
    return {ok:false as const,error:'Operador diferente do proprietário da sessão'};
  }
  const {data:user}=await db.from('usuarios').select('empresa_id,cargo').eq('auth_user_id',campaign.owner_auth_id).maybeSingle();
  if(!user || user.empresa_id!==campaign.empresa_id || !resolveWaAutoPermissions({cargo:user.cargo}).canManage) {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Responsável sem autorização ativa'});
    await db.from('wa_movement_campaigns').update({status:'paused'}).eq('id',campaign.id);
    return {ok:false as const,error:'Sessão responsável sem autorização'};
  }
  const cfg=getWaAutoConfig();
  if(!cfg.integrationToken) {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'uncertain',p_error:'WA_INTEGRATION_TOKEN ausente'});
    return {ok:false as const,error:'Integração WA.Auto sem token no servidor'};
  }
  let result:'sent'|'failed'|'uncertain'='uncertain';
  let failure='';
  let responsePayload:any=null;
  try {
    const response=await fetch(cfg.baseUrl+'/api/integrations/lexispredict/send',{
      method:'POST',
      headers:{
        Authorization:'Bearer '+cfg.integrationToken,
        'x-wa-integration-token':cfg.integrationToken,
        'x-lexis-user-id':String(campaign.owner_auth_id),
        'Content-Type':'application/json',
      },
      body:JSON.stringify({to:claimed.phone,message:claimed.message}),
      cache:'no-store',
      signal:AbortSignal.timeout(40000),
    });
    responsePayload=await response.json().catch(()=>null);
    if(response.ok && responsePayload?.ok!==false) {
      result='sent';
      await persistWhatsAppMessage({
        contactNumber:claimed.phone,messageText:claimed.message,fromMe:true,
        source:'lexis-waauto-movement',empresaId:campaign.empresa_id,
        timestamp:new Date().toISOString(),raw:responsePayload,
        messageId:String(responsePayload?.key?.id||responsePayload?.messageId||claimed.id),
      }).catch(()=>({ok:false}));
    } else {
      // HTTP 4xx returned by the transport is explicitly rejected; never retry.
      result='failed';failure='WA.Auto rejeitou a mensagem (HTTP '+response.status+').';
    }
  } catch {
    // Request may have succeeded remotely before our timeout: never retry.
    result='uncertain';failure='Resposta do WA.Auto desconhecida. Verifique a conversa antes de retomar.';
  }
  const {error:finishError}=await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:result,p_error:failure||null});
  if(finishError) return {ok:false as const,error:'Falha ao confirmar o histórico do envio: '+finishError.message};
  return {ok:result==='sent',processed:true as const,status:result,error:failure||null};
}

export async function deliverMovementFromOperator(campaignId:string) {
  try {
    const ctx=await requireManager();
    const db=await getSupabaseAdmin();
    const {data:campaign}=await db.from('wa_movement_campaigns')
      .select('id,owner_auth_id').eq('empresa_id',ctx.empresa_id).eq('id',campaignId).maybeSingle();
    if(!campaign) throw new Error('Campanha inexistente nesta empresa.');
    if(campaign.owner_auth_id !== ctx.auth_id) throw new Error('Somente o WhatsApp do responsável pode executar esta campanha.');
    return await deliverNextMovement({campaignId,verifiedOwner:ctx.auth_id});
  }catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}
