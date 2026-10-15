import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/server-db';
import {deeplyVerifyClosure} from '@/lib/wa-deep-closure';

export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};

function auth(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 return [process.env.WA_MOVEMENT_CRON_SECRET,process.env.CRON_SECRET]
  .filter((s):s is string=>typeof s==='string'&&s.length>=16)
  .some(s=>s.length===token.length&&timingSafeEqual(Buffer.from(s),Buffer.from(token)));
}

/** Independent court research. No UI session, user click, or WhatsApp
 * connection is required. Exactly one atomic case claim per invocation.
 */
export async function GET(req:Request){
 if(!auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401,headers});
 const db=await getSupabaseAdmin();
 const {data:next,error:selectionError}=await db.from('wa_closure_review_queue')
  .select('empresa_id').lte('next_check_at',new Date().toISOString())
  .order('next_check_at',{ascending:true}).limit(1).maybeSingle();
 if(selectionError)return NextResponse.json({ok:false,error:'Review queue unavailable'},{status:503,headers});
 if(!next)return NextResponse.json({ok:true,processed:0,reason:'all_scheduled'},{headers});
 const tenant=String(next.empresa_id);
 const {data:claims,error:claimError}=await db.rpc('wa_claim_deep_closure',{p_empresa:tenant});
 if(claimError)return NextResponse.json({ok:false,error:'Could not reserve the next investigation'},{status:503,headers});
 const item=claims?.[0];
 if(!item)return NextResponse.json({ok:true,processed:0,reason:'concurrent_claim'},{headers});
 const id=Number(item.processo_id);
 const attempts=Number(item.attempt||1);
 const schedule=async(decisionState:string,reason:string,evidence:any,delayHours:number,legacyStatus:'confirmed'|'needs_official_confirmation')=>{
  const nextTime=new Date(Date.now()+delayHours*3600000).toISOString();
  const {error}=await db.from('wa_closure_review_queue').update({
    status:legacyStatus,decision_state:decisionState,decision_reason:reason.slice(0,900),
    evidence,last_deep_checked_at:new Date().toISOString(),next_check_at:nextTime,
    claimed_at:null,checked_at:new Date().toISOString(),
  }).eq('empresa_id',tenant).eq('processo_id',id).eq('decision_state','deep_scan_running');
  if(error)throw new Error('Could not save judicial investigation');
 };
 try{
  const {data:row,error:loadError}=await db.from('processos')
   .select('id,empresa_id,protocolo_ref,telefone,status,status_interno,dados,em_cumprimento_sentenca,cumprimento_pendente_necessario,detalhes_execucao')
   .eq('empresa_id',tenant).eq('id',id).maybeSingle();
  if(loadError||!row)throw new Error('Process not found');
  if(row.status==='Encerrado'||row.status_interno==='ENCERRADO'){
   await schedule('confirmed_closed','Processo já consta como encerrado pela carteira.',{},87600,'confirmed');
   return NextResponse.json({ok:true,processed:1,decision:'already_closed'},{headers});
  }
  const result=await deeplyVerifyClosure({
   cnj:String(row.protocolo_ref||''),
   hasEnforcement:row.em_cumprimento_sentenca===true,
   hasPendingEnforcement:row.cumprimento_pendente_necessario===true,
   details:row.detalhes_execucao&&typeof row.detalhes_execucao==='object'
      ?row.detalhes_execucao as Record<string,any>:null,
  });
  if(result.decision==='confirmed_closed'){
   // Extra guard against lost updates, and retain an auditable proof trail.
   const {data:updated,error:updateError}=await db.from('processos').update({
    status:'Encerrado',status_interno:'ENCERRADO',
    dados:{...(row.dados||{}),wa_closure_proof:{
     checkedAt:result.checkedAt,source:'DataJud + DJEN',
     decision:'baixa/arquivamento definitivo histórico',
     evidence:result.evidence,reason:result.reason,
    }},
   }).eq('empresa_id',tenant).eq('id',id)
    .neq('status','Encerrado')
    .select('id');
   if(updateError||!updated?.length)throw new Error('Closure record could not be updated safely');
   const {error:queueError}=await db.from('wa_portfolio_scan_queue')
    .update({outreach_status:'ineligible',last_error:'official_court_closure_confirmed'})
    .eq('empresa_id',tenant).eq('processo_id',id);
   if(queueError)throw new Error('Could not exclude closed case from contacts');
   await schedule('confirmed_closed',result.reason,result.evidence,87600,'confirmed');
  }else{
   // Re-run automatically without requiring a person to click "verify".
   const delay=result.decision==='source_unavailable'?Math.min(12,Math.max(1,2**Math.min(attempts-1,3))):
    result.decision==='active_enforcement'?168:Math.min(168,24*Math.max(1,attempts));
   await schedule(result.decision,result.reason,result.evidence,delay,'needs_official_confirmation');
  }
  return NextResponse.json({ok:true,processed:1,decision:result.decision,
    sources:{datajud:result.evidence.datajudOk,djen:result.evidence.djenOk},
    nextCheckHours:result.decision==='confirmed_closed'?null:
      result.decision==='source_unavailable'?Math.min(12,Math.max(1,2**Math.min(attempts-1,3))):
      result.decision==='active_enforcement'?168:Math.min(168,24*Math.max(1,attempts)),
  },{headers});
 }catch(e){
  const msg=e instanceof Error?e.message:'Unknown failure';
  console.error('[deep-closure] '+msg);
  try{await schedule('source_unavailable','Falha técnica da consulta; nova tentativa programada.',{},1,'needs_official_confirmation');}
  catch(inner){console.error('[deep-closure] recovery failed',inner);}
  return NextResponse.json({ok:false,processed:1,error:'Investigation deferred for automatic retry'},{status:503,headers});
 }
}
