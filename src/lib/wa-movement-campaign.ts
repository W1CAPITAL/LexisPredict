/**
 * WA Auto movement alerts. Only stored, dated DataJud/DJEN facts are sent.
 * One campaign per company, one delivery per process+event, atomic DB claims.
 */
import 'server-only';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';
import { getWaAutoConfig, waAutoHealth } from '@/lib/wa-auto-client';
import { persistWhatsAppMessage } from '@/lib/whatsapp-persist';
import { prepareMovementAlert, type SourceRow, type Alert } from '@/lib/wa-movement-builder';
import { preparePublicationNotice, type PublicationSourceRow } from '@/lib/wa-publication-builder';


async function requireManager() {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id || ctx.isViewer ||
      !resolveWaAutoPermissions({cargo: ctx.cargo}).canManage) {
    throw new Error('Somente Supervisor, Administrador ou Superadmin vinculado à empresa pode enviar avisos da carteira.');
  }
  return ctx as typeof ctx & { auth_id: string; empresa_id: string };
}

type CampaignKind='movement'|'publication';


/** Supabase outbound history is not necessarily complete. Never claim that
 * absence of a message here proves the customer was never informed elsewhere.
 */
async function previousPublications(empresaId:string) {
  const db=await getSupabaseAdmin();
  const noticed=new Set<string>();
  const optedOut=new Set<string>();
  for(let start=0;start<25000;start+=500) {
    const {data,error}=await db.from('whatsapp_messages')
      .select('contact_number,phone,message_text,body,from_me')
      .eq('empresa_id',empresaId)
      .order('created_at',{ascending:true}).range(start,start+499);
    if(error)throw new Error('Histórico de avisos indisponível; não iniciar campanha: '+error.message);
    const entries=data||[];
    for(const msg of entries) {
      let phone=String(msg.contact_number||msg.phone||'').replace(/\D/g,'');
      if(phone.length===10||phone.length===11)phone='55'+phone;
      const body=String(msg.message_text||msg.body||'').trim();
      if(msg.from_me===false) {
        if(/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|NAO ME ENVIE MENSAGENS|NÃO ME ENVIE MENSAGENS)[\s.!?]*$/i.test(body))optedOut.add(phone);
        continue;
      }
      if(!/(?:TRANSIT|JULGAD|BAIXA|BAIXADO|EXTINT|ARQUIVAD|ENCERRAD|SENTEN.CA)/i.test(body))continue;
      for(const cnj of body.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g)||[])
        noticed.add(phone+':'+cnj.replace(/\D/g,''));
    }
    if(entries.length<500)return {noticed,optedOut};
  }
  throw new Error('Histórico grande demais para conferência segura nesta execução. Revise o histórico antes de enviar avisos.');
}

async function collectPortfolio(empresaId: string, kind:CampaignKind='movement') {
  const db = await getSupabaseAdmin();
  const entries: Alert[] = [];
  const counts = { scanned: 0, withoutPhone: 0, withoutEvent: 0, blocked: 0, samePhone: 0,
    alreadyClosed:0,consentMissing:0,needsReview:0,alreadyNotified:0 };
  const previous=kind==='publication'?await previousPublications(empresaId):{noticed:new Set<string>(),optedOut:new Set<string>()};
  const seen = new Set<string>();
  // Supabase caps the number of records per request. Pagination covers the entire company.
  for (let offset=0; offset<100000; offset+=400) {
    const {data,error} = await db.from('processos')
      .select('*')
      .eq('empresa_id',empresaId).order('id',{ascending:true}).range(offset,offset+399);
    if (error) throw new Error('Carteira: ' + error.message);
    const rows = (data || []) as SourceRow[];
    for (const row of rows) {
      counts.scanned++;
      const prepared=kind==='publication'?preparePublicationNotice(row as PublicationSourceRow):null;
      const result=kind==='publication'?null:prepareMovementAlert(row);
      const alert=kind==='publication'?prepared?.notice:result?.alert;
      const reason=kind==='publication'?prepared?.reason:result?.reason;
      if (!alert) {
        if (reason==='phone') counts.withoutPhone++;
        else if (reason==='blocked') counts.blocked++;
        else if (reason==='already_closed') counts.alreadyClosed++;
        else if (reason==='consent_missing') counts.consentMissing++;
        else if (reason==='review_verdict'||reason==='review_conflict') counts.needsReview++;
        else if (reason==='already_notified') counts.alreadyNotified++;
        else counts.withoutEvent++;
        continue;
      }
      if(kind==='publication'&&previous.optedOut.has(alert.phone)){
        counts.blocked++;continue;
      }
      if(kind==='publication'&&previous.noticed.has(alert.phone+':'+alert.protocolo.replace(/\D/g,''))) {
        counts.alreadyNotified++;continue;
      }
      const key = alert.processo_id + ':' + alert.event_hash;
      if (seen.has(key)) { counts.samePhone++; continue; }
      seen.add(key);
      entries.push(alert);
    }
    if (rows.length < 400) break;
  }
  return { entries, counts };
}

export async function previewMovementCampaign(kind:CampaignKind='movement') {
  try {
    const ctx = await requireManager();
    const { entries, counts } = await collectPortfolio(ctx.empresa_id,kind);
    const db = await getSupabaseAdmin();
    // Preview excludes already queued/sent versions (database uniqueness also guards races).
    const {data,error} = await db.from('wa_movement_dispatches')
      .select('processo_id,event_hash').eq('empresa_id',ctx.empresa_id).limit(100000);
    if (error) throw new Error('Fila não instalada no Supabase. Aplique a migração: ' + error.message);
    const prior = new Set((data || []).map(x => x.processo_id + ':' + x.event_hash));
    const pending = entries.filter(x => !prior.has(x.processo_id + ':' + x.event_hash));
    return {
      ok: true as const,kind, counts: { ...counts, alreadyQueued: entries.length - pending.length, eligible: pending.length },
      samples: pending.slice(0,5).map(x => ({ client: x.client_name, cnj: x.protocolo, source: x.source, date: x.event_at, message: x.message,
        verdict:(x as any).verdict||null,kind:(x as any).kind||null })),
    };
  } catch (e: any) {
    return {ok:false as const,error:String(e?.message||e)};
  }
}

export async function createMovementCampaign(confirmed: boolean,kind:CampaignKind='movement') {
  try {
    const ctx=await requireManager();
    if (confirmed !== true) throw new Error('Confirme previamente a autorização dos contatos de acompanhamento.');
    const health = await waAutoHealth();
    if (!health.ok) throw new Error('Conecte o WA.Auto antes de iniciar. ' + (health.error || 'Sessão indisponível'));
    const db=await getSupabaseAdmin();
    const {data: existing} = await db.from('wa_movement_campaigns').select('id')
      .eq('empresa_id',ctx.empresa_id).eq('status','running').limit(1);
    if (existing?.length) throw new Error('Já existe uma campanha ativa desta empresa. Pause ou conclua antes de criar outra.');

    const {entries}=await collectPortfolio(ctx.empresa_id,kind);
    if (!entries.length) throw new Error('Nenhum processo com telefone válido e movimentação identificada.');
    const {data: campaign,error: createErr} = await db.from('wa_movement_campaigns')
      .insert({ empresa_id:ctx.empresa_id,owner_auth_id:ctx.auth_id,consent_attested:true,status:'running',campaign_kind:kind })
      .select('id').single();
    if (createErr || !campaign) throw new Error(createErr?.message || 'Não foi possível criar a campanha.');
    let inserted=0;
    try {
      for(let offset=0;offset<entries.length;offset+=150) {
        const values=entries.slice(offset,offset+150).map(x=>({
          empresa_id:x.empresa_id,processo_id:x.processo_id,protocolo:x.protocolo,
          phone:x.phone,client_name:x.client_name,source:x.source,event_at:x.event_at,
          event_hash:x.event_hash,message:x.message,campaign_id:campaign.id,
        }));
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
      .select('id,status,campaign_kind,total,sent_count,failed_count,uncertain_count,next_send_at,created_at')
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
  if (campaign.status==='running') {
    const {data:current,error:rowError}=await db.from('processos')
      .select('*')
      .eq('empresa_id',campaign.empresa_id).eq('id',claimed.processo_id).maybeSingle();
    const isPublication=await db.from('wa_movement_campaigns').select('campaign_kind').eq('id',campaign.id).single();
    if(rowError || !current) {
      await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Processo não localizado na carteira; não enviado'});
      return {ok:false as const,error:'Processo removido da carteira; envio cancelado'};
    }
    if(isPublication.data?.campaign_kind==='publication') {
      const check=preparePublicationNotice(current as PublicationSourceRow);
      if(!check.notice || check.notice.event_hash!==claimed.event_hash || check.notice.phone!==claimed.phone) {
        await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Status, consentimento ou evidência mudou desde a prévia; revisar'});
        return {ok:false as const,error:'Aviso não enviado: dados ou consentimento alterados'};
      }
      // A client may opt out after the preview but before the queued send.
      const {data:replies,error:replyError}=await db.from('whatsapp_messages')
        .select('message_text,body,from_me').eq('empresa_id',campaign.empresa_id)
        .eq('from_me',false)
        .or('contact_number.eq.'+claimed.phone+',phone.eq.'+claimed.phone)
        .order('created_at',{ascending:false}).limit(150);
      if(replyError || (replies||[]).some(x=>/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|NAO ME ENVIE MENSAGENS|NÃO ME ENVIE MENSAGENS)[\s.!?]*$/i.test(String(x.message_text||x.body||'').trim()))) {
        await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Cliente solicitou parar ou não foi possível conferir opt-out'});
        return {ok:false as const,error:'Aviso cancelado: preferência de contato deve ser verificada'};
      }
      const {data:already}=await db.from('wa_movement_dispatches')
         .select('id,message').eq('empresa_id',campaign.empresa_id)
        .eq('processo_id',claimed.processo_id).eq('status','sent')
        .neq('id',claimed.id).limit(150);
      if((already||[]).some(x=>/TRANSIT|JULGAD|BAIXA|BAIXADO|EXTINT|ARQUIVAD|ENCERRAD|SENTEN.CA/i.test(String(x.message||'')))) {
        await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Já consta aviso enviado para este processo; revisar histórico'});
        return {ok:false as const,error:'Processo já possui aviso registrado'};
      }
    }
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
