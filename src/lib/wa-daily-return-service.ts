import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {sendViaWaAuto} from '@/lib/wa-auto-client';
import {persistWhatsAppMessage} from '@/lib/whatsapp-persist';
import {brazilToday,normalizePhone,isStatusRequest,prepareDailyReturn,type ReturnCase,type ReturnMode} from '@/lib/wa-daily-return-policy';

export async function getDailyReturnSettings(empresaId:string) {
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('wa_daily_return_settings').select('enabled,interval_days,owner_auth_id')
    .eq('empresa_id',empresaId).maybeSingle();
  if(error)throw new Error('Configuração do retorno: '+error.message);
  return {enabled:data?.enabled===true,intervalDays:Number(data?.interval_days||1),
    ownerAuthId:data?.owner_auth_id||null};
}
export async function upsertDailyReturnSettings(empresaId:string,ownerAuthId:string,enabled:boolean,intervalDays:number) {
  if(!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>30)throw new Error('Intervalo deve estar entre 1 e 30 dias.');
  const db=await getSupabaseAdmin();
  const {error}=await db.from('wa_daily_return_settings').upsert({
    empresa_id:empresaId,owner_auth_id:ownerAuthId,enabled,interval_days:intervalDays,updated_at:new Date().toISOString(),
  },{onConflict:'empresa_id'});
  if(error)throw new Error(error.message);
}

async function optOutOrWindow(empresaId:string,phone:string,mode:ReturnMode) {
  const db=await getSupabaseAdmin();
  const {data,error}=await db.from('whatsapp_messages')
    .select('from_me,message_text,body,timestamp,created_at')
    .eq('empresa_id',empresaId)
    .or('contact_number.eq.'+phone+',phone.eq.'+phone)
    .order('created_at',{ascending:false}).limit(150);
  if(error)throw new Error('Falha ao consultar preferências do WhatsApp: '+error.message);
  let lastInbound=0;
  for(const m of data||[]) {
    if(m.from_me===true)continue;
    const body=String(m.message_text||m.body||'').trim();
    if(/^(SAIR|STOP|PARE|CANCELAR MENSAGENS|N[AÃ]O ME ENVIE MENSAGENS)[\s.!?]*$/i.test(body))return 'opt_out';
    const ms=Date.parse(String(m.timestamp||m.created_at||''));
    if(Number.isFinite(ms))lastInbound=Math.max(lastInbound,ms);
  }
  // Official business-initiated messages outside the customer-care window
  // require Meta-approved templates. The WA.Auto free-text transport here
  // cannot establish that approval, so skip rather than assume it.
  if(!lastInbound||Date.now()-lastInbound>23*60*60*1000)return 'outside_service_window';
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
  const computed=prepareDailyReturn(row as ReturnCase,{mode:input.mode,today,intervalDays:input.intervalDays});
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
  try {preference=await optOutOrWindow(input.empresaId,notice.phone,input.mode);}
  catch {await check('history_unavailable');return {ok:false,reason:'history_unavailable',sent:false};}
  if(preference){await check(preference);return {ok:true,reason:preference,sent:false};}
  const {data:reserved,error:reserveError}=await db.from('wa_daily_return_sends').insert({
    empresa_id:input.empresaId,processo_id:input.processId,phone:notice.phone,
    local_day:today,event_hash:notice.eventHash,source:notice.source,event_at:notice.eventAt,
    mode:input.mode,message:notice.message,status:'reserved',
  }).select('id').maybeSingle();
  if(reserveError){
    if(reserveError.code==='23505'){await check('already_contacted_today');return {ok:true,reason:'already_contacted_today',sent:false};}
    return {ok:false,reason:reserveError.message,sent:false};
  }
  if(!reserved)return {ok:false,reason:'reservation_failed',sent:false};
  const id=reserved.id;
  // No automatic resend after a timeout: the remote WA.Auto might have
  // accepted the message even when the server did not receive the answer.
  const send=await sendViaWaAuto(notice.phone,notice.message);
  if(!send.ok){
    await db.from('wa_daily_return_sends').update({
      status:'uncertain',last_error:String(send.error||'WA Auto timeout').slice(0,200),
    }).eq('id',id).eq('empresa_id',input.empresaId);
    await check('send_uncertain');
    return {ok:false,reason:'send_uncertain',sent:false,requiresManualReview:true};
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
  // Advance customer-return dates only after the WA.Auto accepted the send
  // and the delivery attempt was durably registered in the history.
  const dados={...(row.dados||{}),ultimoRetorno:today,proximoRetorno:notice.nextReturn,
    wa_ultimo_retorno:{data:today,evento_hash:notice.eventHash,envio_id:id,origem:notice.source}};
  let update=db.from('processos').update({
    ultimo_retorno:today,proximo_retorno:notice.nextReturn,dados,updated_at:now,
  }).eq('empresa_id',input.empresaId).eq('id',input.processId);
  if(row.updated_at)update=update.eq('updated_at',row.updated_at);
  const {data:updated,error:updateError}=await update.select('id').maybeSingle();
  await check(updated?'sent':'sent_dates_review');
  return {ok:true,sent:true,reason:updated?'sent':'sent_dates_review',processId:input.processId,
    eventAt:notice.eventAt,source:notice.source,nextReturn:updated?notice.nextReturn:null,
    requiresManualReview:!updated,error:updateError?.message||undefined};
}
export async function processNextDueReturn(empresaId:string,intervalDays:number) {
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
    hasOfficialRecord=scanned.success===true && scanned.offline!==true;
  } catch {hasOfficialRecord=false;}
  if(!hasOfficialRecord) {
    await db.from('wa_daily_return_checks').upsert({
      empresa_id:empresaId,processo_id:processId,local_day:today,
      mode:'due',result:'court_unavailable',checked_at:new Date().toISOString(),
    },{onConflict:'empresa_id,processo_id,local_day,mode'});
    return {ok:true,processed:true,sent:false,reason:'court_unavailable'};
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
