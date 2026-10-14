import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {evolutionForOwner,evolutionDelivered} from '@/lib/evolution-bridge';
import {persistWhatsAppMessage} from '@/lib/whatsapp-persist';
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
  // No delivery provider: do not reserve a send or alter return dates.
  if (process.env.LEXIS_WHATSAPP_TRANSPORT !== 'official-active') {
    await check('provider_not_configured');
    return {ok:false,reason:'provider_not_configured',sent:false,error:'Automação suspensa: nenhuma API de envio validada.'};
  }
  const {data:id,error:reserveError}=await db.rpc('wa_reserve_return',{
    p_empresa:input.empresaId,p_processo:input.processId,p_phone:notice.phone,p_hash:notice.eventHash,
    p_source:notice.source,p_event_at:notice.eventAt,p_mode:input.mode,p_message:notice.message,
  });
  if(reserveError)return {ok:false,reason:reserveError.message,sent:false};
  if(!id){await check('already_contacted_today');return {ok:true,reason:'already_contacted_today',sent:false};}
  // No automatic resend after a timeout: the remote WA.Auto might have
  // accepted the message even when the server did not receive the answer.
  const send=await evolutionForOwner(String(settings.ownerAuthId||''),input.empresaId,notice.phone,notice.message);
  if(!send.ok){
    await db.from('wa_daily_return_sends').update({
      status:send.rejected?'rejected':'uncertain',last_error:String(send.error||'Evolution timeout').slice(0,200),
    }).eq('id',id).eq('empresa_id',input.empresaId);
    const failure=send.rejected?'send_rejected':'send_uncertain';
    await check(failure);
    return {ok:false,reason:failure,error:send.error,sent:false,requiresManualReview:!send.rejected};
  }
  if(!evolutionDelivered(send.raw)) {
    // A API pode aceitar uma mensagem que o destinatario ainda nao consegue
    // decifrar. Nao registrar atendimento nem data sem recibo de entrega.
    await db.from('wa_daily_return_sends').update({
      status:'uncertain',last_error:'Aceito pela ponte; não houve confirmação de entrega no aparelho',
    }).eq('id',id).eq('empresa_id',input.empresaId);
    await check('send_uncertain');
    return {ok:false,reason:'send_uncertain',sent:false,requiresManualReview:true,
      error:'Evolution aceitou o envio, mas não confirmou entrega legível. Confira o WhatsApp antes de reenviar.'};
  }
  const persisted=await persistWhatsAppMessage({
    contactNumber:notice.phone,messageText:notice.message,fromMe:true,
    messageId:'wa-daily-'+id,source:'lexis-evolution-daily-return',empresaId:input.empresaId,
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
/**
 * Scanner da carteira: filtros locais primeiro, DJEN primeiro, DataJud somente
 * quando a publicação não respondeu à pergunta "houve novidade?".
 * A seleção SQL pula telefones inválidos/encerrados antes de chamar tribunais.
 * Não usa IA nem altera datas em verificações negativas.
 */
const ELIGIBILITY_REASONS=new Set(['closed','phone','blocked','no_consent','not_due','missing_return','invalid_cnj']);
const CACHED_WINDOW_MS=10*60*1000;
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
    consentAttested:settings.consentAttested,
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
  // A comprovacao de DJEN (teor + data + CNJ) já validada vale por 24 h
  // segundo prepareDailyReturn, logo jamais faça uma segunda consulta desnecessária.
  const alreadyVerified=decision.ready!==null;
  const evidenceNewer=latestDjenAfterReturn(row);
  const {auditCaseCoreSystem}=await import('@/app/actions/case-actions');
  const refresh=async(source:'djen'|'datajud')=>{
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
  if(input.queueOnly)return finish('checked_for_queue');
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
