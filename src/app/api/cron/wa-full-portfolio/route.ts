import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';
import { enqueueScannedMovement, queueNextMovementForTenant } from '@/lib/wa-movement-campaign';
import {confirmedTerminalEvent} from '@/lib/judicial-terminal-evidence';

export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};

function authorized(req:Request){
  const token=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  return [process.env.WA_MOVEMENT_CRON_SECRET,process.env.CRON_SECRET]
    .filter((s):s is string=>typeof s==='string'&&s.length>=16)
    .some(secret=>token.length===secret.length&&timingSafeEqual(Buffer.from(token),Buffer.from(secret)));
}

/**
 * Durable whole-portfolio audit. Runs only with a server-side credential.
 * One case per invocation prevents 60s function timeouts and minimizes court
 * API throttling. Queue claims are transactional and tenant-scoped.
 * It never directly sends a WhatsApp message; confirmed new events use
 * the existing opt-in, deduplicated movement queue and linked-device worker.
 */
export async function GET(request:Request){
  if(!authorized(request))
    return NextResponse.json({ok:false,error:'Unauthorized'},{status:401,headers});
  const db=await getSupabaseAdmin();
  const {data:tenantRow,error:tenantErr}=await db.from('wa_portfolio_scan_queue')
    .select('empresa_id').in('status',['pending','processing'])
    .lt('attempts',3).order('id',{ascending:true}).limit(1).maybeSingle();
  if(tenantErr)return NextResponse.json({ok:false,error:'Queue unavailable'}, {status:503,headers});
  if(!tenantRow)return NextResponse.json({ok:true,processed:0,reason:'no_pending_cases'},{headers});
  const {data:claimed,error:claimErr}=await db.rpc('wa_portfolio_scan_claim',{p_empresa:tenantRow.empresa_id});
  if(claimErr)return NextResponse.json({ok:false,error:'Unable to claim scan'}, {status:503,headers});
  const task=claimed?.[0];
  if(!task)return NextResponse.json({ok:true,processed:0,reason:'not_due_or_already_claimed'},{headers});
  const empresaId=String(task.company_id),id=Number(task.process_id),queueId=Number(task.queue_id);
  async function finish(status:'verified'|'partial'|'unavailable'|'failed'|'invalid',
    dj=false,djen=false,reason:string|null=null) {
    const {error}=await db.from('wa_portfolio_scan_queue')
      .update({status,datajud_ok:dj,djen_ok:djen,last_error:reason?.slice(0,170)||null,
        finished_at:new Date().toISOString()})
      .eq('empresa_id',empresaId).eq('id',queueId).eq('status','processing');
    if(error)throw new Error('Unable to finish scan');
  }
  try {
    const {data:proc,error:procErr}=await db.from('processos')
      .select('id,protocolo_ref,empresa_id').eq('empresa_id',empresaId).eq('id',id).maybeSingle();
    const cnj=String(proc?.protocolo_ref||'').replace(/\D/g,'');
    if(procErr||!proc||!/^[0-9]{20}$/.test(cnj)) {
      await finish('invalid',false,false,'Cadastro ausente ou CNJ inválido');
      return NextResponse.json({ok:true,processed:1,status:'invalid'},{headers});
    }
    const scan=await auditCaseCoreSystem(String(proc.protocolo_ref),empresaId,'both',{
      fast:true,cloudBudget:true,useClaudeAi:false,
    });
    const dj=scan.sourceStatus?.datajud?.ok===true;
    const djen=scan.sourceStatus?.djen?.ok===true;
    // A historical termination flag is STICKY in the portfolio scanner and
    // is not evidence on its own. Reclassify only if both official sources
    // successfully refreshed and the last DataJud event ITSELF is an
    // unequivocal >365-day-old definitive discharge/archival, with no later
    // DJEN event and no active enforcement stage.
    let closedByFreshProof=false;
    const {data:closureReview,error:reviewError}=await db.from('wa_closure_review_queue')
      .select('processo_id,status').eq('empresa_id',empresaId).eq('processo_id',id)
      .eq('status','needs_official_confirmation').maybeSingle();
    if(reviewError)throw new Error('Closure review unavailable');
    if(closureReview){
      if(dj&&djen){
        const {data:verified,error:verifiedError}=await db.from('processos')
          .select('id,status,status_interno,telefone,datajud_last_ok,datajud_encerrado_tribunal,datajud_ultimo_nome,datajud_ultimo_movimento,datajud_consultado_em,djen_last_ok,djen_consultado_em,djen_ultima_data,em_cumprimento_sentenca,cumprimento_pendente_necessario,status_executivo,dados')
          .eq('empresa_id',empresaId).eq('id',id).maybeSingle();
        if(verifiedError||!verified)throw new Error('Fresh court closure confirmation unavailable');
        const lastMs=Date.parse(String(verified.datajud_ultimo_movimento||''));
        const djenMs=Date.parse(String(verified.djen_ultima_data||''));
        const sourceMs=Date.parse(String(verified.datajud_consultado_em||''));
        const finalAct=confirmedTerminalEvent(String(verified.datajud_ultimo_nome||''));
        const strongProof=verified.datajud_last_ok===true&&verified.djen_last_ok===true
          &&verified.datajud_encerrado_tribunal===true
          &&(finalAct==='baixa'||finalAct==='arquivamento')
          &&Number.isFinite(lastMs)&&lastMs<Date.now()-365*86400000
          &&Number.isFinite(sourceMs)&&Date.now()-sourceMs<3600000
          &&(!Number.isFinite(djenMs)||djenMs<=lastMs)
          &&verified.em_cumprimento_sentenca!==true
          &&verified.cumprimento_pendente_necessario!==true
          &&!/execut|cumprim|pendente|ativo/i.test(String(verified.status_executivo||''))
          &&String(verified.telefone||'').replace(/\D/g,'').length<10
          &&verified.status!=='Encerrado'&&verified.status_interno!=='ENCERRADO';
        if(strongProof){
          const {error:closeError}=await db.from('processos').update({
            status:'Encerrado',status_interno:'ENCERRADO',
            dados:{...(verified.dados||{}),
              wa_closure_proof:{
                source:'DataJud e DJEN',event:'baixa/arquivamento definitivo',
                eventAt:new Date(lastMs).toISOString(),
                verifiedAt:new Date().toISOString(),origin:'verificacao automatica de processo antigo',
              }},
          }).eq('empresa_id',empresaId).eq('id',id);
          if(closeError)throw new Error('Court-proven closure could not be saved');
          const {error:queueError}=await db.from('wa_portfolio_scan_queue')
            .update({outreach_status:'ineligible',last_error:'closed_after_fresh_court_confirmation'})
            .eq('empresa_id',empresaId).eq('processo_id',id);
          if(queueError)throw new Error('Closure queue could not be saved');
          closedByFreshProof=true;
        }
        const {error:reviewUpdateError}=await db.from('wa_closure_review_queue')
          .update({status:closedByFreshProof?'confirmed':'manual_review',
            checked_at:new Date().toISOString()})
          .eq('empresa_id',empresaId).eq('processo_id',id);
        if(reviewUpdateError)throw new Error('Could not record closure review');
      } else {
        await db.from('wa_closure_review_queue').update({checked_at:new Date().toISOString()})
          .eq('empresa_id',empresaId).eq('processo_id',id);
      }
    }
    if(!dj&&!djen){
      await finish('unavailable',false,false,'Fontes oficiais indisponíveis nesta tentativa');
      return NextResponse.json({ok:true,processed:1,status:'unavailable',
        source:{datajud:false,djen:false}},{headers});
    }
    // An idempotent second attempt is safe: the underlying function already
    // invokes the enqueue hook and the notification hash is globally unique.
    let immediatelyQueued=false;
    try {
      // Tribunal analysis continues during a restricted WhatsApp connection,
      // but a restricted tenant must NEVER create outbound delivery jobs.
      const {data:safety,error:safetyError}=await db.from('wa_outbound_safety_limits')
        .select('paused,cooldown_until').eq('empresa_id',empresaId).maybeSingle();
      if(safetyError)throw Error('Outbound safety status unavailable');
      const blocked=!!safety&&(safety.paused||
        Boolean(safety.cooldown_until&&Date.parse(safety.cooldown_until)>Date.now()));
      if(!blocked){
      await enqueueScannedMovement(empresaId,id);
      // Claim at most one validated notice immediately after this scan:
      // no wait for a second full-portfolio pass. Acknowledgement remains
      // the responsibility of the connected WhatsApp worker.
      const next=await queueNextMovementForTenant(empresaId);
      immediatelyQueued=next.queued===true;
      }
    } catch(e){ console.warn('[portfolio-audit] movement queue deferred',
      e instanceof Error?e.message:'unknown'); }
    await finish(dj&&djen?'verified':'partial',dj,djen,null);
    return NextResponse.json({ok:true,processed:1,status:dj&&djen?'verified':'partial',
      source:{datajud:dj,djen},queued:immediatelyQueued,closedByFreshProof},{headers});
  } catch(e){
    console.error('[portfolio-audit] failed',e instanceof Error?e.message:'unknown');
    await finish('failed',false,false,'Falha na verificação; sem notificação');
    return NextResponse.json({ok:false,processed:1,status:'failed',
      error:'Scan failed for this case'},{status:503,headers});
  }
}
