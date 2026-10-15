import 'server-only';
import {createHash} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {contactOptedOut} from '@/lib/wa-contact-privacy';
import {prepareMovementAlert} from '@/lib/wa-movement-builder';
import {enqueueScannedMovement} from '@/lib/wa-movement-campaign';
import {bridgeStatus} from '@/lib/whatsapp-local';
import {getDailyReturnSettings} from '@/lib/wa-daily-return-service';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {clientFirstName,clientGreeting,CLIENT_NOTICE_OPT_OUT} from '@/lib/wa-client-notice';
import {isCasoEncerrado} from '@/lib/status-encerrado';

function normalizePhone(input:unknown) {
  const digits=String(input||'').replace(/\D/g,'');
  const phone=digits.length===10||digits.length===11?'55'+digits:digits;
  return /^55\d{10,11}$/.test(phone)?phone:'';
}
function explicitBlock(meta:Record<string,any>){
  const stop=['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout',
    'bloquear_whatsapp','naoEnviarWhatsapp'];
  if(stop.some(k=>['true','sim','s','1','yes'].includes(String(meta[k]??'').toLowerCase())))return true;
  return ['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado']
    .some(k=>['false','não','nao','0','no'].includes(String(meta[k]??'').toLowerCase()));
}
function businessWindow(){
  const date=new Date();
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
    hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(date);
  const hour=Number(fmt.find(p=>p.type==='hour')?.value||0);
  const day=fmt.find(p=>p.type==='weekday')?.value||'';
  return !['Sat','Sun'].includes(day)&&hour>=9&&hour<18;
}

/**
 * The owner requested one follow-up to each opt-in contact AFTER checking
 * court sources. New events have priority in the movement campaign; contacts
 * with no verified new event can receive a neutral, non-substantive update.
 * Each contact number appears only once in the one-time portfolio campaign.
 */
export async function queueCheckedPortfolioContact(empresaId:string){
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled||!settings.consentAttested)return {queued:false,reason:'automation_disabled'};
  if(!settings.sendAnytime&&!businessWindow())return {queued:false,reason:'outside_business_hours'};
  const db=await getSupabaseAdmin();
  const status=await bridgeStatus(empresaId);
  if(!status.connected)return {queued:false,reason:'device_offline'};
  const {data:items,error}=await db.from('wa_portfolio_scan_queue')
    .select('id,processo_id,contact_phone')
    .eq('empresa_id',empresaId).in('status',['verified','partial']).eq('outreach_status','pending')
    .order('id',{ascending:true}).limit(8);
  if(error)throw new Error('Full-portfolio contact queue unavailable');
  if(!items?.length)return {queued:false,reason:'no_verified_contact'};
  for(const item of items){
    const updateStatus=async(outreach_status:string,outreach_job_id?:string)=>{
      const patch:any={outreach_status};
      if(outreach_job_id)patch.outreach_job_id=outreach_job_id;
      const {error:e}=await db.from('wa_portfolio_scan_queue')
        .update(patch).eq('empresa_id',empresaId).eq('id',item.id)
        .eq('outreach_status','pending');
      if(e)throw new Error('Contact ledger unavailable');
    };
    const {data:caseRow,error:caseErr}=await db.from('processos').select('*')
      .eq('empresa_id',empresaId).eq('id',item.processo_id).maybeSingle();
    const row=caseRow as any;
    const phone=row?normalizePhone(row.telefone||row.dados?.telefone||row.dados?.TELEFONE):'';
    if(caseErr||!row||!phone||phone!==item.contact_phone){
      await updateStatus('no_phone');continue;
    }
    if(explicitBlock(row.dados||{}) || await contactOptedOut(empresaId,phone)){
      await updateStatus('blocked');continue;
    }
    // Cases with a new confirmed court event should receive the meaningful
    // movement notification, never a generic update in its place.
    const prepared=prepareMovementAlert(row,true);
    if(prepared.alert){
      await enqueueScannedMovement(empresaId,Number(item.processo_id));
      await updateStatus('movement');
      continue;
    }
    // Do not imply a win, closure, payment, or even the absence of a new
    // movement when it has not been verified. A human can explain on reply.
    const message='Olá! Tudo bem? Aqui é do setor processual da GET Assessoria. '
      +'Fizemos uma nova consulta às informações oficiais disponíveis sobre o processo acompanhado pela nossa equipe. '
      +'Se quiser saber os detalhes ou tiver alguma dúvida, pode falar com nossa equipe por aqui. '
      +'Se preferir não receber novos avisos, é só responder SAIR.';
    const hash=createHash('sha256')
      .update([empresaId,item.processo_id,'portfolio-checkin-authorized-20261014'].join('|'))
      .digest('hex');
    // Shared, atomic 45-second / 120-per-day reservation: never bypass it.
    const {data:sendId,error:reserveError}=await db.rpc('wa_reserve_return',{
      p_empresa:empresaId,p_processo:item.processo_id,p_phone:phone,p_hash:hash,
      p_source:'DJEN',p_event_at:new Date().toISOString(),p_mode:'single',p_message:message,
    });
    if(reserveError)throw new Error('Unable to reserve checked contact');
    if(!sendId){
      // A different campaign may have already contacted this same phone today.
      const {data:sent}=await db.from('wa_daily_return_sends').select('id')
        .eq('empresa_id',empresaId).eq('phone',phone).eq('status','sent')
        .eq('local_day',new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
          year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())).limit(1);
      if(sent?.length){await updateStatus('covered');continue;}
      return {queued:false,reason:'daily_limit_or_gap'};
    }
    const {data:jobId,error:attachError}=await db.rpc('wa_local_attach_return',{
      p_empresa:empresaId,p_send:sendId,
    });
    if(attachError||!jobId){
      await db.from('wa_daily_return_sends')
        .update({status:'rejected',last_error:'Linked device queue unavailable'})
        .eq('empresa_id',empresaId).eq('id',sendId).eq('status','reserved');
      return {queued:false,reason:'device_queue_error'};
    }
    await updateStatus('queued',String(jobId));
    return {queued:true,reason:'queued_neutral_checkin'};
  }
  return {queued:false,reason:'no_eligible_contact'};
}


/**
 * One real overdue follow-up, distinct from a new judicial movement.
 * Every candidate was scanned through at least one official court source,
 * is due TODAY, and belongs to a tenant with ongoing opt-in attestation.
 * This never changes last/next return dates itself: the WhatsApp ACK trigger
 * is the sole writer of a confirmed check-in's dates.
 */
export async function queueOverdueContact(empresaId:string){
  const settings=await getDailyReturnSettings(empresaId);
  if(!settings.enabled||!settings.consentAttested)
    return {queued:false,reason:'automation_disabled'};
  if(!settings.sendAnytime&&!businessWindow())
    return {queued:false,reason:'outside_business_hours'};
  if(!(await bridgeStatus(empresaId)).connected)
    return {queued:false,reason:'device_offline'};
  const db=await getSupabaseAdmin(),day=brazilToday();
  const {data:candidates,error:loadError}=await db.rpc('wa_next_checked_overdue',{
    p_empresa:empresaId,p_day:day,p_limit:30,
  });
  if(loadError)throw new Error('Erro na seleção de vencidos: '+loadError.message);
  if(!candidates?.length)return {queued:false,reason:'no_verified_overdue'};
  for(const item of candidates){
    const update=async (state:'no_phone'|'blocked'|'ineligible'|'movement'|'queued',jobId?:string)=>{
      const {error}=await db.from('wa_portfolio_scan_queue')
        .update({outreach_status:state,...(jobId?{outreach_job_id:jobId}:{})})
        .eq('empresa_id',empresaId).eq('id',item.queue_id).eq('outreach_status','pending');
      if(error)throw new Error('Registro da fila indisponível');
    };
    const {data:row,error:caseError}=await db.from('processos').select('*')
      .eq('empresa_id',empresaId).eq('id',item.process_id).maybeSingle();
    if(caseError||!row){await update('ineligible');continue;}
    const phone=normalizePhone(row.telefone||row.dados?.telefone||row.dados?.TELEFONE);
    if(!phone||phone!==item.phone){await update('no_phone');continue;}
    if(!row.proximo_retorno || String(row.proximo_retorno).slice(0,10)>day ||
       isCasoEncerrado(row)){await update('ineligible');continue;}
    if(explicitBlock(row.dados||{}) || await contactOptedOut(empresaId,phone)){
      await update('blocked');continue;
    }
    // New court evidence is actionable and gets a substantive notice, rather
    // than being replaced by a generic overdue follow-up.
    const newEvent=prepareMovementAlert(row,settings.consentAttested);
    if(newEvent.alert){
      await enqueueScannedMovement(empresaId,Number(row.id));
      await update('movement');
      continue;
    }
    // A phone can legitimately own several cases, but it should not receive
    // repeated outbound notices on the same day or within 24 hours.
    const {data:recent,error:recentError}=await db.from('wa_daily_return_sends')
      .select('id').eq('empresa_id',empresaId).eq('phone',phone)
      .in('status',['reserved','sent','uncertain'])
      .gte('created_at',new Date(Date.now()-24*3600_000).toISOString()).limit(1);
    if(recentError)throw new Error('Não foi possível conferir contatos recentes');
    if(recent?.length)continue;
    const name=clientFirstName(String(row.cliente||row.dados?.cliente||''));
    const digits=String(row.protocolo_ref||'').replace(/\D/g,'');
    const cnj=digits.length===20
      ?digits.slice(0,7)+'-'+digits.slice(7,9)+'.'+digits.slice(9,13)+'.'+digits.slice(13,14)+'.'+digits.slice(14,16)+'.'+digits.slice(16)
      :'';
    if(!cnj){await update('ineligible');continue;}
    const message=[
      clientGreeting(name),
      'Estamos entrando em contato para realizar seu retorno periódico referente ao processo nº '+cnj+'.',
      'Nossa equipe realizou uma conferência das informações oficiais disponíveis e segue à disposição para explicar os registros e esclarecer suas dúvidas. Esta mensagem não indica, por si só, uma nova decisão ou movimentação.',
      'Se quiser conversar sobre o andamento do seu processo, pode responder por aqui.',
      CLIENT_NOTICE_OPT_OUT,
    ].join('\n\n');
    // Same due cycle = same hash; a fresh cycle only starts when the prior
    // contact was actually acknowledged and the next-return date advanced.
    const hash=createHash('sha256').update(
      [empresaId,row.id,String(row.proximo_retorno).slice(0,10),'overdue-checkin-v1'].join('|')
    ).digest('hex');
    const {data:sendId,error:reserveError}=await db.rpc('wa_reserve_return',{
      p_empresa:empresaId,p_processo:row.id,p_phone:phone,
      p_hash:hash,p_source:'Acompanhamento',p_event_at:new Date().toISOString(),
      p_mode:'checkin',p_message:message,
    });
    if(reserveError)throw new Error('Erro ao reservar retorno vencido: '+reserveError.message);
    if(!sendId)return {queued:false,reason:'shared_gap_or_daily_limit'};
    const {data:jobId,error:attachError}=await db.rpc('wa_local_attach_return',{
      p_empresa:empresaId,p_send:sendId,
    });
    if(attachError||!jobId){
      await db.from('wa_daily_return_sends').update({
        status:'rejected',last_error:'Fila de dispositivo indisponível antes do envio'
      }).eq('empresa_id',empresaId).eq('id',sendId).eq('status','reserved');
      return {queued:false,reason:'device_queue_unavailable'};
    }
    await update('queued',String(jobId));
    return {queued:true,reason:'overdue_checkin_queued',jobId:String(jobId)};
  }
  return {queued:false,reason:'no_available_overdue'};
}
