/**
 * WA Auto movement alerts. Only stored, dated DataJud/DJEN facts are sent.
 * One campaign per company, one delivery per process+event, atomic DB claims.
 */
import 'server-only';
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { resolveWaAutoPermissions } from '@/lib/wa-auto-permissions';
import {bridgeStatus} from '@/lib/whatsapp-local';
import {contactOptedOut} from '@/lib/wa-contact-privacy';
import { prepareMovementAlert, type SourceRow, type Alert } from '@/lib/wa-movement-builder';
import {getDailyReturnSettings,upsertDailyReturnSettings} from '@/lib/wa-daily-return-service';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {isCasoEncerrado} from '@/lib/status-encerrado';


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
    alreadyClosed:0, closedEligible:0, consentMissing:0, needsReview:0, alreadyNotified:0, missingReturn:0, noNewMovement:0 };
  let after=0;
  for (;;) {
    const {data,error}=await db.rpc('wa_notice_portfolio_rows',{p_empresa:empresaId,p_after:after,p_limit:3000});
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
        else if(reason==='needs_source_review')counts.needsReview++;
        else if(reason==='no_new_movement')counts.noNewMovement++;
        else counts.withoutEvent++;
      } else {
        entries.push(alert);
        if(isCasoEncerrado(row))counts.closedEligible++;
      }
    }
    if(rows.length<3000)break;
    after=Number(rows[rows.length-1].id);
  }
  return {entries,counts};
}

export async function previewMovementCampaign(kind:CampaignKind='movement') {
  try {
    const ctx = await requireManager();
    const settings=await getDailyReturnSettings(ctx.empresa_id);
    const db = await getSupabaseAdmin();
    const [portfolio, priorResponse] = await Promise.all([
      collectPortfolio(ctx.empresa_id,kind,true), // prévia sob autorização contratual a registrar pelo gestor ao iniciar
      db.rpc('wa_notice_prior',{p_empresa:ctx.empresa_id}),
    ]);
    const {entries,counts}=portfolio;
    // Preview excludes already queued/sent versions (database uniqueness also guards races).
    const {data,error}=priorResponse;
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
    // Campaigns belong to the tenant's connected WA.Auto device, not to
    // the outdated Evolution operator or a browser tab.
    const health=await bridgeStatus(ctx.empresa_id);
    if(!health.connected)throw new Error('O WA.Auto desta empresa precisa estar conectado para iniciar a campanha.');
    const db=await getSupabaseAdmin();
    const {data: existing} = await db.from('wa_movement_campaigns').select('id')
      .eq('empresa_id',ctx.empresa_id).eq('status','running').limit(1);
    if (existing?.length) throw new Error('Já existe uma campanha ativa desta empresa. Pause ou conclua antes de criar outra.');

    if(confirmed)await upsertDailyReturnSettings(ctx.empresa_id,ctx.auth_id,settings.enabled,settings.intervalDays,true);
    const {entries}=await collectPortfolio(ctx.empresa_id,kind,confirmed||settings.consentAttested);
    if (!entries.length) throw new Error(
      kind === 'publication'
        ? 'Nenhum aviso elegível: confira telefone, último retorno e nova publicação verificada na carteira.'
        : 'Nenhum processo com telefone válido e movimentação identificada.'
    );
    const {data: campaign,error: createErr} = await db.from('wa_movement_campaigns')
      .insert({ empresa_id:ctx.empresa_id,owner_auth_id:ctx.auth_id,consent_attested:confirmed || settings.consentAttested,status:'paused',campaign_kind:kind })
      .select('id').single();
    if (createErr || !campaign) throw new Error(createErr?.message || 'Não foi possível criar a campanha.');
    let inserted=0;
    try {
      // One atomic SQL batch per 300 records rather than 150+ sequential
      // network round trips for a portfolio of ~2,600 cases.
      for(let offset=0;offset<entries.length;offset+=300) {
        const batch=entries.slice(offset,offset+300);
        const {data:accepted,error:batchError}=await db.rpc('wa_add_campaign_notices',{
          p_campaign:campaign.id,p_notices:batch,
        });
        if(batchError)throw new Error('Não foi possível preparar os avisos: '+batchError.message);
        inserted+=Number(accepted||0);
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
    if(!data)return {ok:true as const,campaign:null};
    const [pending,review]=await Promise.all([
      db.from('wa_movement_dispatches').select('id',{count:'exact',head:true})
        .eq('empresa_id',ctx.empresa_id).eq('campaign_id',data.id).in('status',['pending','processing']),
      db.from('wa_movement_dispatches').select('id',{count:'exact',head:true})
        .eq('empresa_id',ctx.empresa_id).eq('campaign_id',data.id).eq('status','cancelled').like('last_error','source_review:%'),
    ]);
    if(pending.error||review.error)throw new Error('Não foi possível conferir o progresso da fila.');
    return {ok:true as const,campaign:{...data,pending_count:pending.count||0,review_count:review.count||0}};
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
      const health=await bridgeStatus(ctx.empresa_id);
      if(!health.connected)throw new Error('O dispositivo WA.Auto desta empresa está desconectado.');
      const {data:other}=await db.from('wa_movement_campaigns').select('id')
        .eq('empresa_id',ctx.empresa_id).eq('status','running').neq('id',id).limit(1);
      if(other?.length) throw new Error('Outra campanha já está ativa.');
    }
    if(action!=='resume' && campaign.status!=='running' && campaign.status!=='paused') throw new Error('Campanha já finalizada.');
    const newStatus= action==='resume'?'running':action==='pause'?'paused':'cancelled';
    const {error:changeError}=await db.from('wa_movement_campaigns')
      .update({status:newStatus,next_send_at:new Date().toISOString(),updated_at:new Date().toISOString(),
        ...(action==='resume'?{owner_auth_id:ctx.auth_id}:{})})
      .eq('empresa_id',ctx.empresa_id).eq('id',id);
    if(changeError) throw changeError;
    if(action==='cancel') await db.from('wa_movement_dispatches').update({status:'cancelled'})
      .eq('empresa_id',ctx.empresa_id).eq('campaign_id',id).eq('status','pending');
    return {ok:true as const};
  } catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}

/** Run only behind the company's scoped 256-bit worker authorization
 * (or a separately authenticated manager action).
 * Performs ONE candidate claim and queues at most one WhatsApp device job.
 * It NEVER reports "sent" until the worker acknowledges acceptance.
 */
export async function queueNextMovementForTenant(empresaId:string,campaignId?:string){
  const local=new Date(), hour=Number(new Intl.DateTimeFormat('en-GB',{
    timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23',
  }).format(local)), weekday=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',weekday:'short',
  }).format(local);
  if(hour<9||hour>=18||['Sat','Sun'].includes(weekday))
    return {ok:true as const,queued:false,processed:false,reason:'outside_business_hours'};
  const connection=await bridgeStatus(empresaId);
  if(!connection.connected)
    return {ok:true as const,queued:false,processed:false,reason:'device_offline'};
  const db=await getSupabaseAdmin();
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled||!settings.consentAttested)
    return {ok:true as const,queued:false,processed:false,reason:'automation_disabled'};
  let id=campaignId;
  if(!id){
    const {data,error}=await db.from('wa_movement_campaigns')
      .select('id').eq('empresa_id',empresaId).eq('status','running')
      .lte('next_send_at',new Date().toISOString())
      .order('next_send_at',{ascending:true}).limit(1).maybeSingle();
    if(error)throw new Error('Campanha indisponível: '+error.message);
    id=data?.id;
  }
  if(!id)return {ok:true as const,queued:false,processed:false,reason:'no_running_campaign'};
  const {data:batch,error:claimError}=await db.rpc('wa_claim_movement',{p_campaign:id});
  if(claimError)throw new Error('Fila indisponível: '+claimError.message);
  const item=(batch||[])[0] as (Alert&{id:string;campaign_id:string;empresa_id:string;processo_id:number;phone:string})|undefined;
  if(!item)return {ok:true as const,queued:false,processed:false,reason:'no_due_movement'};
  if(item.empresa_id!==empresaId){
    // Never process work from another tenant under a linked-device token.
    return {ok:false as const,queued:false,processed:false,reason:'tenant_mismatch'};
  }
  const {data:campaign,error:campaignError}=await db.from('wa_movement_campaigns')
    .select('id,empresa_id,owner_auth_id,status,consent_attested,campaign_kind')
    .eq('empresa_id',empresaId).eq('id',item.campaign_id).maybeSingle();
  if(campaignError||!campaign||campaign.status!=='running'||!campaign.consent_attested){
    await db.rpc('wa_finish_movement',{p_id:item.id,p_status:'failed',p_error:'Campanha sem autorização ativa'});
    return {ok:true as const,processed:true,queued:false,reason:'campaign_ineligible'};
  }
  const {data:owner}=await db.from('usuarios')
    .select('empresa_id,cargo').eq('auth_user_id',campaign.owner_auth_id).maybeSingle();
  if(!owner||owner.empresa_id!==empresaId||
      !resolveWaAutoPermissions({cargo:owner.cargo}).canManage){
    await db.rpc('wa_finish_movement',{p_id:item.id,p_status:'failed',p_error:'Operador sem autorização atual'});
    await db.from('wa_movement_campaigns').update({status:'paused'}).eq('empresa_id',empresaId).eq('id',campaign.id);
    return {ok:true as const,processed:true,queued:false,reason:'owner_ineligible'};
  }
  const {data:current,error:caseError}=await db.from('processos').select('*')
    .eq('empresa_id',empresaId).eq('id',item.processo_id).maybeSingle();
  const evaluated=!caseError&&current?prepareMovementAlert(current as SourceRow,settings.consentAttested):null;
  if(!evaluated?.alert||evaluated.alert.event_hash!==item.event_hash||
     evaluated.alert.phone!==item.phone){
    await db.rpc('wa_finish_movement',{p_id:item.id,p_status:'failed',
      p_error:'Evento mudou ou exige revisão: '+(evaluated?.reason||'case_missing')});
    return {ok:true as const,processed:true,queued:false,reason:evaluated?.reason||'case_missing'};
  }
  // Respect SAIR without depending on saved chat transcripts.
  let blocked=false;
  try{blocked=await contactOptedOut(empresaId,item.phone);}
  catch{
    await db.from('wa_movement_dispatches').update({status:'pending',claimed_at:null,
      last_error:'Preferência indisponível; emissão adiada'})
      .eq('empresa_id',empresaId).eq('id',item.id).eq('status','processing');
    return {ok:false as const,processed:false,queued:false,reason:'preferences_unavailable'};
  }
  if(blocked){
    await db.rpc('wa_finish_movement',{p_id:item.id,p_status:'failed',
      p_error:'Opt-out ou histórico indisponível: nenhum envio realizado'});
    return {ok:true as const,processed:true,queued:false,reason:'contact_blocked'};
  }
  const {data:reservation,error:reserveError}=await db.rpc('wa_reserve_return',{
    p_empresa:empresaId,p_processo:item.processo_id,p_phone:item.phone,
    p_hash:item.event_hash,p_source:item.source,p_event_at:item.event_at,
    p_mode:campaign.campaign_kind==='publication'?'publication':'movement',
    p_message:evaluated.alert.message,
  });
  if(reserveError){
    await db.from('wa_movement_dispatches')
      .update({status:'pending',claimed_at:null,last_error:reserveError.message.slice(0,200)})
      .eq('empresa_id',empresaId).eq('id',item.id).eq('status','processing');
    return {ok:false as const,processed:true,queued:false,reason:'reservation_error'};
  }
  if(!reservation){
    await db.from('wa_movement_dispatches')
      .update({status:'pending',claimed_at:null})
      .eq('empresa_id',empresaId).eq('id',item.id).eq('status','processing');
    return {ok:true as const,processed:false,queued:false,reason:'daily_limit_or_duplicate'};
  }
  const {data:job,error:attachError}=await db.rpc('wa_local_attach_return',{
    p_empresa:empresaId,p_send:reservation,
  });
  if(attachError||!job){
    await db.from('wa_daily_return_sends').update({status:'rejected',
      last_error:attachError?.message||'Fila WA.Auto indisponível'})
      .eq('empresa_id',empresaId).eq('id',reservation).eq('status','reserved');
    await db.from('wa_movement_dispatches')
      .update({status:'pending',claimed_at:null,
        last_error:'Falha ao registrar na fila do WhatsApp'})
      .eq('empresa_id',empresaId).eq('id',item.id).eq('status','processing');
    return {ok:false as const,processed:true,queued:false,reason:'job_attach_failed'};
  }
  const {error:bindError}=await db.from('wa_movement_dispatches')
    .update({wa_job_id:job})
    .eq('empresa_id',empresaId).eq('id',item.id).eq('status','processing');
  if(bindError){
    // The device job is already queued. DO NOT make a second reservation:
    // a future uncertain state must require operator review.
    await db.from('wa_movement_campaigns').update({status:'paused'})
      .eq('empresa_id',empresaId).eq('id',campaign.id);
    return {ok:false as const,processed:true,queued:true,reason:'job_link_review'};
  }
  return {ok:true as const,processed:true,queued:true,reason:'queued_for_send',jobId:String(job)};
}

/** Legacy authenticated command stays callable but no longer sends through
 * Evolution, claims ownership of a private session, or needs an open tab.
 */
export async function deliverMovementFromOperator(campaignId:string){
  try{
    const ctx=await requireManager();
    return await queueNextMovementForTenant(ctx.empresa_id,campaignId);
  }catch(e:any){return {ok:false as const,error:String(e?.message||e)};}
}

/** Signed legacy cron: uses the same linked-device queue as the worker. */
export async function deliverNextMovement(options:{campaignId?:string;verifiedOwner?:string}={}){
  if(!options.campaignId)return {ok:true as const,queued:false,processed:false,reason:'worker_dispatch_required'};
  return queueNextMovementForTenant('',options.campaignId);
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
  // A cancelled batch is an operator decision. The scanner may prepare a
  // genuinely new event later, but must not silently restart that same notice.
  const cancelled=await db.from('wa_movement_dispatches').select('id,wa_movement_campaigns!inner(status)')
    .eq('empresa_id',empresaId).eq('processo_id',processId).eq('event_hash',prepared.alert.event_hash)
    .eq('status','cancelled').eq('wa_movement_campaigns.status','cancelled').limit(1);
  if(cancelled.error)throw new Error(cancelled.error.message);
  if(cancelled.data?.length)return {queued:false,reason:'campaign_cancelled'};
  const {data,error:queueError}=await db.rpc('wa_enqueue_notice',{p_empresa:empresaId,p_owner:settings.ownerAuthId,p_notice:prepared.alert});
  if(queueError)throw new Error(queueError.message);
  if(data)await db.from('wa_movement_dispatches').update({last_error:'source_review_resolved: Teor oficial conferido; versão válida preparada.'})
    .eq('empresa_id',empresaId).eq('processo_id',processId).eq('status','cancelled').like('last_error','source_review:%');
  return {queued:!!data};
}
