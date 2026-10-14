import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {bridgeStatus} from '@/lib/whatsapp-local';
import {contactOptedOut} from '@/lib/wa-contact-privacy';
import {brazilToday,normalizePhone,isStatusRequest,prepareDailyReturn,validReturnDay,type ReturnCase,type ReturnMode} from '@/lib/wa-daily-return-policy';

export async function getDailyReturnSettings(empresaId:string) {
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('wa_daily_return_settings').select('enabled,interval_days,owner_auth_id,consent_attested')
    .eq('empresa_id',empresaId).maybeSingle();
  if(error)throw new Error('Configuração do retorno: '+error.message);
  return {enabled:data?.enabled===true,intervalDays:Number(data?.interval_days||1),
    consentAttested:data?.consent_attested===true, ownerAuthId:data?.owner_auth_id||null};
}
export async function upsertDailyReturnSettings(empresaId:string,ownerAuthId:string,enabled:boolean,intervalDays:number,consentAttested?:boolean) {
  if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>30)throw new Error('Intervalo deve estar entre 1 e 30 dias.');
  const db=await getSupabaseAdmin();
  const {error}=await db.from('wa_daily_return_settings').upsert({
    empresa_id:empresaId,owner_auth_id:ownerAuthId,enabled,interval_days:intervalDays,updated_at:new Date().toISOString(),
    ...(consentAttested===true?{consent_attested:true,consent_attested_at:new Date().toISOString(),consent_attested_by:ownerAuthId}:{}),
  },{onConflict:'empresa_id'});
  if(error)throw new Error(error.message);
}

async function currentOptOut(empresaId:string,phone:string,mode:ReturnMode) {
  // Chat transcripts are intentionally not stored in Supabase.
  // Explicit SAIR flags are the authoritative, durable preference.
  // Any lookup failure must fail closed before queueing a message.
  return (await contactOptedOut(empresaId,phone)) ? 'opt_out' : null;
}
export async function processOneDailyReturn(input:{
  empresaId:string;processId:number;mode:ReturnMode;intervalDays?:number;today?:string;
}) {
  const db=await getSupabaseAdmin();
  const today=input.today||brazilToday();
  const {data:row,error:loadError}=await db.from('processos').select('*')
    .eq('empresa_id',input.empresaId).eq('id',input.processId).maybeSingle();
  if(loadError||!row)return {ok:false,reason:'processo_nao_encontrado',sent:false};
  const settings=await getDailyReturnSettings(input.empresaId);
  // A scanner may prepare notices while automation is off; it must NEVER
  // turn a scheduled check into an outbound message in that state.
  if(input.mode==='due' && !settings.enabled){
    return {ok:true,reason:'automation_disabled',sent:false,processId:input.processId};
  }
  const computed=prepareDailyReturn(row as ReturnCase,{mode:input.mode,today,intervalDays:input.intervalDays,consentAttested:settings.consentAttested,includeClosed:true});
  const reason=computed.reason;
  const check=async(result:string)=>{
    if(input.mode==='due')await db.from('wa_daily_return_checks').upsert({
      empresa_id:input.empresaId,processo_id:input.processId,local_day:today,mode:'due',result,
      checked_at:new Date().toISOString(),
    },{onConflict:'empresa_id,processo_id,local_day,mode'});
  };
  if(!computed.ready){await check(reason);return {ok:true,reason,sent:false,processId:input.processId};}
  const notice=computed.ready;
  let preference:string|null;
  try {preference=await currentOptOut(input.empresaId,notice.phone,input.mode);}
  catch {await check('history_unavailable');return {ok:false,reason:'history_unavailable',sent:false};}
  if(preference){await check(preference);return {ok:true,reason:preference,sent:false};}
  // The linked WhatsApp device is the current transport. Queue a message once
  // and let its authenticated worker report actual accepted/delivered/read.
  // Merely creating a pending job NEVER marks a client as contacted.
  const bridge=await bridgeStatus(input.empresaId);
  if(!bridge.connected){
    await check('ready_for_notice');
    return {ok:false,reason:'bridge_offline',sent:false,queued:false};
  }
  const {data:id,error:reserveError}=await db.rpc('wa_reserve_return',{
    p_empresa:input.empresaId,p_processo:input.processId,p_phone:notice.phone,
    p_hash:notice.eventHash,p_source:notice.source,p_event_at:notice.eventAt,
    p_mode:input.mode,p_message:notice.message,
  });
  if(reserveError){await check('ready_for_notice');return {ok:false,reason:'reserve_failed',sent:false,error:reserveError.message};}
  if(!id){
    // Null can also mean the 45-second anti-spam gap is in force.
    // Preserve the candidate for a later automatic retry rather than losing it.
    const {data:prior}=await db.from('wa_daily_return_sends').select('id')
      .eq('empresa_id',input.empresaId).eq('phone',notice.phone)
      .eq('local_day',today).in('status',['reserved','sent','uncertain']).limit(1);
    const reason=prior?.length?'already_contacted_today':'ready_for_notice';
    await check(reason);
    return {ok:true,reason,sent:false,queued:false,processId:input.processId};
  }
  const {data:jobId,error:attachError}=await db.rpc('wa_local_attach_return',{
    p_empresa:input.empresaId,p_send:id,
  });
  if(attachError||!jobId){
    await db.from('wa_daily_return_sends').update({
      status:'rejected',last_error:attachError?.message||'Falha ao inserir na fila do dispositivo',
    }).eq('empresa_id',input.empresaId).eq('id',id).eq('status','reserved');
    await check('ready_for_notice');
    return {ok:false,reason:'queue_failed',error:attachError?.message,sent:false,queued:false};
  }
  await check('queued_for_send');
  return {ok:true,reason:'queued_for_send',sent:false,queued:true,
    jobId:String(jobId),processId:input.processId,source:notice.source,eventAt:notice.eventAt};

}
/**
 * Scanner da carteira: filtros locais primeiro, DJEN primeiro, DataJud somente
 * quando a publicação não respondeu à pergunta "houve novidade?".
 * A seleção SQL pula telefones inválidos/encerrados antes de chamar tribunais.
 * Não usa IA nem altera datas em verificações negativas.
 */
const ELIGIBILITY_REASONS=new Set(['phone','blocked','no_consent','not_due','missing_return','invalid_cnj']);
// A successful recent verification of both sources can be reused for six
// hours when no new movement was found. Notice-ready items remain subject
// to the strict 24-hour evidence checks in prepareDailyReturn.
const CACHED_WINDOW_MS=6*60*60*1000;
function checkedRecently(at:unknown,ok:unknown,cutoff:number){
  return ok===true && typeof at==='string' && Number.isFinite(Date.parse(at))
    && Date.parse(at)>=cutoff && Date.parse(at)<=Date.now()+60000;
}
function latestDjenAfterReturn(row:ReturnCase){
  const last=validReturnDay(row.ultimo_retorno||row.dados?.ultimoRetorno||row.dados?.ultimo_retorno);
  const djen=validReturnDay(row.djen_ultima_data);
  return Boolean(last&&djen&&djen>last);
}
async function recordDueCheck(db:any,empresaId:string,processId:number,today:string,result:string){
  const {error}=await db.from('wa_daily_return_checks').upsert({
    empresa_id:empresaId,processo_id:processId,local_day:today,
    mode:'due',result,checked_at:new Date().toISOString(),
  },{onConflict:'empresa_id,processo_id,local_day,mode'});
  if(error)throw new Error('Não foi possível registrar conferência segura: '+error.message);
}
async function getReturnCase(db:any,empresaId:string,processId:number):Promise<ReturnCase|null>{
  const {data,error}=await db.from('processos').select('*')
    .eq('empresa_id',empresaId).eq('id',processId).maybeSingle();
  if(error)throw new Error('Falha ao carregar processo: '+error.message);
  return data as ReturnCase|null;
}
/** Confere um processo selecionado sem consultar os dois tribunais por padrão. */
export async function checkReturnSources(input:{
  empresaId:string;processId:number;mode:ReturnMode;intervalDays:number;
  today?:string;queueOnly?:boolean;
}){
  const db=await getSupabaseAdmin();
  const today=input.today||brazilToday();
  let row=await getReturnCase(db,input.empresaId,input.processId);
  if(!row)return {ok:false,processed:true,sent:false,reason:'case_missing',processId:input.processId};
  const settings=await getDailyReturnSettings(input.empresaId);
  const evaluate=(item:ReturnCase)=>prepareDailyReturn(item,{
    mode:input.mode,today,intervalDays:input.intervalDays,
    consentAttested:settings.consentAttested,includeClosed:true,
  });
  let decision=evaluate(row);
  const finish=async(reason:string,ok=true)=>{
    if(input.mode==='due')await recordDueCheck(db,input.empresaId,input.processId,today,reason);
    return {ok,processed:true,sent:false,reason,processId:input.processId};
  };
  if(ELIGIBILITY_REASONS.has(decision.reason))return finish(decision.reason);
  if(!String(row.protocolo_ref||'').replace(/\D/g,'').match(/^\d{20}$/))
    return finish('invalid_cnj');
  const cutoff=Date.now()-CACHED_WINDOW_MS;
  const recentDjen=checkedRecently((row as any).djen_consultado_em,(row as any).djen_last_ok,cutoff);
  const recentDatajud=checkedRecently((row as any).datajud_consultado_em,(row as any).datajud_last_ok,cutoff);
  let courtSource:'cached'|'djen'|'datajud'='cached';
  // Positive movement evidence valid for <=24h is already checked in policy.
  // Never call the court again for a ready notice just to repeat the scan.
  const alreadyVerified=decision.ready!==null;
  const evidenceNewer=latestDjenAfterReturn(row);
  // A recent confirmed scan of BOTH sources with no novelty is conclusive
  // enough for this 6h window. Skip BOTH HTTP requests and record the check.
  if(!alreadyVerified && decision.reason==='no_new_movement' && recentDjen && recentDatajud){
    return finish('recent_scan_no_new_movement');
  }
  // Load the heavyweight scanner module ONLY when an external lookup is needed.
  const refresh=async(source:'djen'|'datajud')=>{
    const {auditCaseCoreSystem}=await import('@/app/actions/case-actions');
    courtSource=source;
    const last=validReturnDay(row?.ultimo_retorno||row?.dados?.ultimoRetorno||row?.dados?.ultimo_retorno);
    const since=last?new Date(Date.parse(last+'T00:00:00Z')-86400000).toISOString().slice(0,10):undefined;
    const result=await auditCaseCoreSystem(String(row?.protocolo_ref),input.empresaId,source,{
      fast:true,cloudBudget:true,useClaudeAi:false,...(source==='djen'&&since?{djenSince:since}:{}),
    });
    const confirmed=result.success===true && result.sourceStatus?.[source]?.ok===true;
    if(!confirmed)return false;
    const updated=await getReturnCase(db,input.empresaId,input.processId);
    if(updated){row=updated;decision=evaluate(row);}
    return true;
  };
  if(!alreadyVerified){
    // Se DJEN já é posterior ao último contato, atualizar APENAS DJEN.
    // Quando sua prova oficial for suficiente, NÃO consultar DataJud.
    if(evidenceNewer || !recentDjen){
      let official=false;
      try{official=await refresh('djen');}
      catch{official=false;}
      if(!official&&evidenceNewer)return finish('court_unavailable');
    }
    if(decision.ready===null &&
       (decision.reason==='needs_source_review'&&latestDjenAfterReturn(row))){
      // Teor terminal/ambíguo é revisão humana, não convite a consultar
      // DataJud de forma redundante ou anunciar extinção sem confirmação.
      return finish('needs_source_review');
    }
    // Não há publicação suficiente no DJEN: DataJud apenas como fallback.
    if(decision.ready===null &&
       (decision.reason==='no_new_movement'||decision.reason==='needs_source_review')
       &&!recentDatajud){
      let official=false;
      try{official=await refresh('datajud');}
      catch{official=false;}
      if(!official&&!recentDjen)return finish('court_unavailable');
    }
  }
  // The cloud scanner is a *preparation* service, not the delivery provider.
  // Preserve the distinction between confirmed new evidence and no novelty.
  if(input.queueOnly || (input.mode==='due' && !settings.enabled)){
    const reason=decision.ready?'ready_for_notice':decision.reason;
    const result=await finish(reason);
    return {...result,prepared:decision.ready!==null,sourceChecked:courtSource};
  }
  // Avoid attempting a send for unchanged/ambiguous events.
  if(!decision.ready)return finish(decision.reason);
  const result=await processOneDailyReturn({
    empresaId:input.empresaId,processId:input.processId,mode:input.mode,
    intervalDays:input.intervalDays,today,
  });
  // O processOneDailyReturn só altera datas após confirmação do envio.
  // Em modo due, já registra o próprio resultado no ledger de conferências.
  return {...result,processed:true,processId:input.processId,sourceChecked:courtSource};
}
export async function processNextDueReturn(empresaId:string,intervalDays:number,queueOnly=false) {
  const db=await getSupabaseAdmin(),today=brazilToday();
  const {data,error}=await db.rpc('wa_next_due_return',{p_empresa:empresaId,p_day:today});
  if(error)throw new Error('Scanner indisponível: '+error.message);
  if(!data)return {ok:true,processed:false,reason:'no_due_cases'};
  return await checkReturnSources({empresaId,processId:Number(data),mode:'due',intervalDays,today,queueOnly});
}


/** Consume already-verified DJEN/DataJud notices before scanning new CNJs.
 * Runs from the signed Vercel cron and the currently connected worker, with
 * the existing 45s/daily/hour anti-spam reservation enforced by Postgres.
 */
export async function dispatchPreparedDailyReturns(empresaId:string,intervalDays:number){
  const db=await getSupabaseAdmin(),today=brazilToday();
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled||!settings.consentAttested)
    return {ok:true,processed:false,reason:'automation_disabled'};
  const bridge=await bridgeStatus(empresaId);
  if(!bridge.connected)return {ok:true,processed:false,reason:'bridge_offline'};
  const earliest=new Date(today+'T12:00:00Z');
  earliest.setUTCDate(earliest.getUTCDate()-2);
  const {data,error}=await db.from('wa_daily_return_checks').select('processo_id,local_day')
    .eq('empresa_id',empresaId).gte('local_day',earliest.toISOString().slice(0,10))
    .lte('local_day',today).eq('mode','due')
    .in('result',['ready_for_notice','provider_not_configured'])
    .order('checked_at',{ascending:true}).limit(5);
  if(error)throw new Error('Fila de comunicados indisponível: '+error.message);
  for(const candidate of data||[]){
    const result=await processOneDailyReturn({
      empresaId,processId:Number(candidate.processo_id),mode:'due',
      intervalDays,today,
    });
    // The scanner may have prepared this yesterday just before closing.
    // Migrate it forward only after it is queued, superseded, or invalidated.
    // Otherwise keep it pending for the next safe business-hour attempt.
    if(candidate.local_day!==today &&
      !['ready_for_notice','bridge_offline','reserve_failed','queue_failed'].includes(result.reason)){
      await db.from('wa_daily_return_checks').update({
        result:'carried_forward',checked_at:new Date().toISOString(),
      }).eq('empresa_id',empresaId).eq('processo_id',candidate.processo_id)
        .eq('local_day',candidate.local_day).eq('mode','due')
        .in('result',['ready_for_notice','provider_not_configured']);
    }
    if(result.queued||result.reason==='ready_for_notice'||result.reason==='bridge_offline')
      return {...result,processed:true};
    if(result.ok&&result.reason==='already_contacted_today')continue;
    // A rejected consent or a stale proof will get its own check result.
    if(!result.ok)return {...result,processed:true};
  }
  return {ok:true,processed:false,reason:'no_prepared_notices'};
}

/** Called only by a signed webhook after the inbound text was persisted in
 * the correct tenant. If a phone matches several cases, reveal nothing.
 */
export async function processIncomingReturnRequest(empresaId:string,phoneInput:string,text:string){
  if(!isStatusRequest(text))return {ok:true,sent:false,reason:'not_status_request'};
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled)return {ok:true,sent:false,reason:'automation_disabled'};
  const phone=normalizePhone(phoneInput);
  if(!phone)return {ok:true,sent:false,reason:'invalid_phone'};
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('processos').select('id,telefone')
    .eq('empresa_id',empresaId).ilike('telefone','%'+phone.slice(-8)+'%').limit(30);
  if(error)return {ok:false,sent:false,reason:'lookup_failed'};
  const matches=(data||[]).filter(x=>normalizePhone(x.telefone)===phone);
  if(matches.length!==1)return {ok:true,sent:false,reason:matches.length?'ambiguous_case':'case_not_found'};
  return processOneDailyReturn({empresaId,processId:matches[0].id,mode:'requested',
    intervalDays:settings.intervalDays});
}
