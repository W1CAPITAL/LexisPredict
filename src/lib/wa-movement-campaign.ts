/**
 * WA Auto movement alerts. Only stored, dated DataJud/DJEN facts are sent.
 * One campaign per company, one delivery per process+event, atomic DB claims.
 */
import 'server-only';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';
import { waAutoHealth, waAutoForOwner, sendViaWaAuto } from '@/lib/wa-auto-client';
import { persistWhatsAppMessage } from '@/lib/whatsapp-persist';
import { prepareMovementAlert, type SourceRow, type Alert } from '@/lib/wa-movement-builder';
import {getDailyReturnSettings,upsertDailyReturnSettings} from '@/lib/wa-daily-return-service';
import {brazilToday} from '@/lib/wa-daily-return-policy';


async function requireManager() {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id || ctx.isViewer ||
      !resolveWaAutoPermissions({cargo: ctx.cargo}).canManage) {
    throw new Error('Somente Supervisor, Administrador ou Superadmin vinculado à empresa pode enviar avisos da carteira.');
  }
  return ctx as typeof ctx & { auth_id: string; empresa_id: string };
}

type CampaignKind='movement'|'publication';


async function collectPortfolio(empresaId: string, kind:CampaignKind='movement', attested=false) {
  const db = await getSupabaseAdmin();
  const entries: Alert[] = [];
  const counts = { scanned:0, withoutPhone:0, withoutEvent:0, blocked:0, samePhone:0,
    alreadyClosed:0, consentMissing:0, needsReview:0, alreadyNotified:0, missingReturn:0, noNewMovement:0 };
  let after=0;
  for (;;) {
    const {data,error}=await db.rpc('wa_notice_portfolio_rows',{p_empresa:empresaId,p_after:after,p_limit:600});
    if(error)throw new Error('Carteira: '+error.message);
    const rows=(data||[]) as SourceRow[];
    for(const row of rows) {
      counts.scanned++;
      const {alert,reason}=prepareMovementAlert(row,attested);
      if(!alert) {
        if(reason==='phone')counts.withoutPhone++;
        else if(reason==='blocked')counts.blocked++;
        else if(reason==='closed')counts.alreadyClosed++;
        else if(reason==='no_consent')counts.consentMissing++;
        else if(reason==='missing_return')counts.missingReturn++;
        else if(reason==='no_new_movement')counts.noNewMovement++;
        else counts.withoutEvent++;
      } else entries.push(alert);
    }
    if(rows.length<600)break;
    after=Number(rows[rows.length-1].id);
  }
  return {entries,counts};
}

export async function previewMovementCampaign(kind:CampaignKind='movement') {
  try {
    const ctx = await requireManager();
    const settings=await getDailyReturnSettings(ctx.empresa_id);
    const { entries, counts } = await collectPortfolio(ctx.empresa_id,kind,settings.consentAttested);
    const db = await getSupabaseAdmin();
    // Preview excludes already queued/sent versions (database uniqueness also guards races).
    const {data,error} = await db.rpc('wa_notice_prior',{p_empresa:ctx.empresa_id});
    if (error) throw new Error('Fila não instalada no Supabase. Aplique a migração: ' + error.message);
    const prior = new Set((data || []).map((x:{processo_id:number;event_hash:string}) => x.processo_id + ':' + x.event_hash));
    const pending = entries.filter(x => !prior.has(x.processo_id + ':' + x.event_hash));
    return {
      ok: true as const,kind, counts: { ...counts, alreadyQueued: entries.length - pending.length, eligible: pending.length },
      consentAttested:settings.consentAttested, samples: pending.slice(0,5).map(x => ({ client: x.client_name, cnj: x.protocolo, source: x.source, date: x.event_at, message: x.message,
        verdict:(x as any).verdict||null,kind:(x as any).kind||null })),
    };
  } catch (e: any) {
    return {ok:false as const,error:String(e?.message||e)};
  }
}

export async function createMovementCampaign(confirmed: boolean,kind:CampaignKind='movement') {
  try {
    const ctx=await requireManager();
    // Recorded portfolio consent avoids repeated prompts; individual refusal always wins.
    const settings=await getDailyReturnSettings(ctx.empresa_id);
    if (!settings.consentAttested && confirmed !== true)
      throw new Error('Confirme previamente a autorização dos contatos de acompanhamento.');
    const health = await waAutoHealth();
    if (!health.ok) throw new Error('Conecte o WA.Auto antes de iniciar. ' + (health.error || 'Sessão indisponível'));
    const db=await getSupabaseAdmin();
    const {data: existing} = await db.from('wa_movement_campaigns').select('id')
      .eq('empresa_id',ctx.empresa_id).eq('status','running').limit(1);
    if (existing?.length) throw new Error('Já existe uma campanha ativa desta empresa. Pause ou conclua antes de criar outra.');

    if(confirmed)await upsertDailyReturnSettings(ctx.empresa_id,ctx.auth_id,settings.enabled,settings.intervalDays,true);
    const {entries}=await collectPortfolio(ctx.empresa_id,kind,confirmed||settings.consentAttested);
    if (!entries.length) throw new Error(
      kind === 'publication'
        ? 'Nenhum aviso elegível: confira telefone, data do último retorno e novidade em processos abertos.'
        : 'Nenhum processo com telefone válido e movimentação identificada.'
    );
    const {data: campaign,error: createErr} = await db.from('wa_movement_campaigns')
      .insert({ empresa_id:ctx.empresa_id,owner_auth_id:ctx.auth_id,consent_attested:confirmed || settings.consentAttested,status:'paused',campaign_kind:kind })
      .select('id').single();
    if (createErr || !campaign) throw new Error(createErr?.message || 'Não foi possível criar a campanha.');
    let inserted=0;
    try {
      for(let offset=0;offset<entries.length;offset+=12) {
        const results=await Promise.all(entries.slice(offset,offset+12).map(notice=>
          db.rpc('wa_add_campaign_notice',{p_campaign:campaign.id,p_notice:notice})));
        for(const result of results) {
          if(result.error)throw new Error(result.error.message);
          if(result.data)inserted++;
        }
      }
      await db.from('wa_movement_campaigns').update({total:inserted,status:inserted?'running':'completed'}).eq('id',campaign.id).eq('empresa_id',ctx.empresa_id);
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
  const settings=await getDailyReturnSettings(campaign.empresa_id);
  const {data:current,error:rowError}=await db.from('processos').select('*')
    .eq('empresa_id',campaign.empresa_id).eq('id',claimed.processo_id).maybeSingle();
  const check=current ? prepareMovementAlert(current as SourceRow,settings.consentAttested) : null;
  if(rowError || !check?.alert || check.alert.event_hash!==claimed.event_hash || check.alert.phone!==claimed.phone) {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Carteira alterada ou retorno já registrado: aviso cancelado'});
    return {ok:true as const,processed:true as const,status:'skipped',reason:check?.reason||'case_missing'};
  }
  // Check current opt-out before EACH delivery, not only at preparation.
  const {data:replies,error:replyError}=await db.from('whatsapp_messages')
    .select('message_text,body').eq('empresa_id',campaign.empresa_id).eq('from_me',false)
    .or('contact_number.eq.'+claimed.phone+',phone.eq.'+claimed.phone+',contact_number.eq.'+claimed.phone.slice(2)+',phone.eq.'+claimed.phone.slice(2))
    .order('created_at',{ascending:false}).limit(150);
  if(replyError || (replies||[]).some(x=>/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|N[AÃ]O ME ENVIE MENSAGENS)[\s.!?]*$/i.test(String(x.message_text||x.body||'').trim()))) {
    await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:'failed',p_error:'Opt-out ou histórico indisponível; não enviado'});
    return {ok:true as const,processed:true as const,status:'skipped'};
  }
  const today=brazilToday();
  const {data:reservation,error:reserveError}=await db.rpc('wa_reserve_return',{
    p_empresa:campaign.empresa_id,p_processo:claimed.processo_id,p_phone:claimed.phone,p_hash:claimed.event_hash,
    p_source:claimed.source,p_event_at:claimed.event_at,p_mode:'movement',p_message:check.alert.message,
  });
  if(reserveError)throw new Error(reserveError.message);
  if(!reservation) {
    // Another path may have contacted this phone or reached the common quota.
    await db.from('wa_movement_dispatches').update({status:'pending',claimed_at:null})
      .eq('id',claimed.id).eq('status','processing');
    return {ok:true as const,processed:false as const,reason:'contact_or_quota_reserved'};
  }
  const send=options.verifiedOwner ? await sendViaWaAuto(claimed.phone,check.alert.message)
    : await waAutoForOwner(campaign.owner_auth_id,campaign.empresa_id,claimed.phone,check.alert.message);
  const result=send.ok?'sent':send.rejected?'failed':'uncertain';
  const failure=send.ok?null:send.error;
  await db.from('wa_daily_return_sends').update({status:send.ok?'sent':send.rejected?'rejected':'uncertain',
    sent_at:send.ok?new Date().toISOString():null,last_error:failure}).eq('id',reservation);
  if(send.ok) {
    const history=await persistWhatsAppMessage({contactNumber:claimed.phone,messageText:check.alert.message,
      fromMe:true,source:'lexis-waauto-movement',empresaId:campaign.empresa_id,
      messageId:'wa-return-'+reservation,raw:send.raw});
    if(history.ok)await db.rpc('wa_record_return',{p_empresa:campaign.empresa_id,p_processo:claimed.processo_id,
      p_prior:current.ultimo_retorno||null,p_day:today,p_interval:settings.intervalDays,p_send:reservation});
  }
  const {error:finishError}=await db.rpc('wa_finish_movement',{p_id:claimed.id,p_status:result,p_error:failure});
  if(!send.ok && send.rejected && (send.httpStatus===401||send.httpStatus===403||send.httpStatus===409))
    await db.from('wa_movement_campaigns').update({status:'paused'}).eq('id',campaign.id);
  if(finishError)return {ok:false as const,error:'Histórico do envio: '+finishError.message};
  return {ok:send.ok,processed:true as const,status:result,error:failure};
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

/** Scanner hook: queues a dated newer event for ALL owners in this tenant.
 * No remote WhatsApp call delays the tribunal scanner. */
export async function enqueueScannedMovement(empresaId:string,processId:number) {
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled||!settings.ownerAuthId)return {queued:false};
  const db=await getSupabaseAdmin();
  const {data:row,error}=await db.rpc('wa_notice_portfolio_rows',{p_empresa:empresaId,p_after:processId-1,p_limit:1});
  const current=(row||[])[0] as SourceRow|undefined;
  if(error||!current||Number(current.id)!==processId)return {queued:false};
  const prepared=prepareMovementAlert(current,settings.consentAttested);
  if(!prepared.alert)return {queued:false,reason:prepared.reason};
  const {data,error:queueError}=await db.rpc('wa_enqueue_notice',{p_empresa:empresaId,p_owner:settings.ownerAuthId,p_notice:prepared.alert});
  if(queueError)throw new Error(queueError.message);
  return {queued:!!data};
}
