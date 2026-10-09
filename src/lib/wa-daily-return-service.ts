import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {waAutoForOwner} from '@/lib/wa-auto-client';
import {persistWhatsAppMessage} from '@/lib/whatsapp-persist';
import {brazilToday,normalizePhone,isStatusRequest,prepareDailyReturn,type ReturnCase,type ReturnMode} from '@/lib/wa-daily-return-policy';

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
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('whatsapp_messages')
    .select('from_me,message_text,body,timestamp,created_at')
    .eq('empresa_id',empresaId)
    .or('contact_number.eq.'+phone+',phone.eq.'+phone+',contact_number.eq.'+phone.slice(2)+',phone.eq.'+phone.slice(2))
    .order('created_at',{ascending:false}).limit(150);
  if(error)throw new Error('Falha ao consultar preferências do WhatsApp: '+error.message);
  for(const m of data||[]) {
    if(m.from_me===true)continue;
    const body=String(m.message_text||m.body||'').trim();
    if(/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|N[AÃ]O ME ENVIE MENSAGENS)[\s.!?]*$/i.test(body))return 'opt_out';
  }
  return null;
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
  const computed=prepareDailyReturn(row as ReturnCase,{mode:input.mode,today,intervalDays:input.intervalDays,consentAttested:settings.consentAttested});
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
  const {data:id,error:reserveError}=await db.rpc('wa_reserve_return',{
    p_empresa:input.empresaId,p_processo:input.processId,p_phone:notice.phone,p_hash:notice.eventHash,
    p_source:notice.source,p_event_at:notice.eventAt,p_mode:input.mode,p_message:notice.message,
  });
  if(reserveError)return {ok:false,reason:reserveError.message,sent:false};
  if(!id){await check('already_contacted_today');return {ok:true,reason:'already_contacted_today',sent:false};}
  // No automatic resend after a timeout: the remote WA.Auto might have
  // accepted the message even when the server did not receive the answer.
  const send=await waAutoForOwner(String(settings.ownerAuthId||''),input.empresaId,notice.phone,notice.message);
  if(!send.ok){
    await db.from('wa_daily_return_sends').update({
      status:send.rejected?'rejected':'uncertain',last_error:String(send.error||'WA Auto timeout').slice(0,200),
    }).eq('id',id).eq('empresa_id',input.empresaId);
    const failure=send.rejected?'send_rejected':'send_uncertain';
    await check(failure);
    return {ok:false,reason:failure,error:send.error,sent:false,requiresManualReview:!send.rejected};
  }
  const persisted=await persistWhatsAppMessage({
    contactNumber:notice.phone,messageText:notice.message,fromMe:true,
    messageId:'wa-daily-'+id,source:'lexis-waauto-daily-return',empresaId:input.empresaId,
  });
  const now=new Date().toISOString();
  await db.from('wa_daily_return_sends').update({
    status:'sent',sent_at:now,last_error:persisted.ok?null:'Histórico não gravado: '+(persisted.error||'unknown'),
  }).eq('id',id).eq('empresa_id',input.empresaId);
  if(!persisted.ok){
    await check('sent_history_unsaved');
    return {ok:true,sent:true,reason:'sent_history_unsaved',processId:input.processId,requiresManualReview:true};
  }
  const {data:updated,error:updateError}=await db.rpc('wa_record_return',{
    p_empresa:input.empresaId,p_processo:input.processId,p_prior:row.ultimo_retorno||null,
    p_day:today,p_interval:input.intervalDays||settings.intervalDays,p_send:id,
  });
  await check(updated?'sent':'sent_dates_review');
  return {ok:true,sent:true,reason:updated?'sent':'sent_dates_review',processId:input.processId,
    eventAt:notice.eventAt,source:notice.source,nextReturn:updated?notice.nextReturn:null,
    requiresManualReview:!updated,error:updateError?.message||undefined};
}
export async function processNextDueReturn(empresaId:string,intervalDays:number,queueOnly=false) {
  const db=await getSupabaseAdmin();const today=brazilToday();
  const {data,error}=await db.rpc('wa_next_due_return',{p_empresa:empresaId,p_day:today});
  if(error)throw new Error('Scanner indisponível: '+error.message);
  if(!data)return {ok:true,processed:false,reason:'no_due_cases'};
  const processId=Number(data);
  // Refresh exactly this one case before deciding whether its latest event
  // is truly newer than the client's last return. No paid LLM involved.
  const {data:row}=await db.from('processos').select('protocolo_ref')
    .eq('empresa_id',empresaId).eq('id',processId).maybeSingle();
  if(!row?.protocolo_ref)return {ok:false,processed:true,sent:false,reason:'case_missing'};
  let hasOfficialRecord=false;
  try {
    const {auditCaseCoreSystem}=await import('@/app/actions/case-actions');
    const scanned=await auditCaseCoreSystem(row.protocolo_ref,empresaId,'both',
      {fast:true,cloudBudget:true,useClaudeAi:false});
    hasOfficialRecord=scanned.success===true && (scanned.sourceStatus?.datajud.ok===true || scanned.sourceStatus?.djen.ok===true);
  } catch {hasOfficialRecord=false;}
  if(!hasOfficialRecord) {
    await db.from('wa_daily_return_checks').upsert({
      empresa_id:empresaId,processo_id:processId,local_day:today,
      mode:'due',result:'court_unavailable',checked_at:new Date().toISOString(),
    },{onConflict:'empresa_id,processo_id,local_day,mode'});
    return {ok:true,processed:true,sent:false,reason:'court_unavailable'};
  }
  if(queueOnly) {
    await db.from('wa_daily_return_checks').upsert({empresa_id:empresaId,processo_id:processId,local_day:today,mode:'due',result:'checked_for_queue',checked_at:new Date().toISOString()}, {onConflict:'empresa_id,processo_id,local_day,mode'});
    return {ok:true,processed:true,sent:false,reason:'checked_for_queue'};
  }
  return {...await processOneDailyReturn({empresaId,processId,mode:'due',intervalDays,today}),processed:true};
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
