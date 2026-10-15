import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server-db';
import { auditCaseCoreSystem } from '@/app/actions/case-actions';
import { enqueueScannedMovement, queueNextMovementForTenant } from '@/lib/wa-movement-campaign';

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
    if(!dj&&!djen){
      await finish('unavailable',false,false,'Fontes oficiais indisponíveis nesta tentativa');
      return NextResponse.json({ok:true,processed:1,status:'unavailable',
        source:{datajud:false,djen:false}},{headers});
    }
    // An idempotent second attempt is safe: the underlying function already
    // invokes the enqueue hook and the notification hash is globally unique.
    let immediatelyQueued=false;
    try {
      await enqueueScannedMovement(empresaId,id);
      // Claim at most one validated notice immediately after this scan:
      // no wait for a second full-portfolio pass. Acknowledgement remains
      // the responsibility of the connected WhatsApp worker.
      const next=await queueNextMovementForTenant(empresaId);
      immediatelyQueued=next.queued===true;
    } catch(e){ console.warn('[portfolio-audit] movement queue deferred',
      e instanceof Error?e.message:'unknown'); }
    await finish(dj&&djen?'verified':'partial',dj,djen,null);
    return NextResponse.json({ok:true,processed:1,status:dj&&djen?'verified':'partial',
      source:{datajud:dj,djen},queued:immediatelyQueued},{headers});
  } catch(e){
    console.error('[portfolio-audit] failed',e instanceof Error?e.message:'unknown');
    await finish('failed',false,false,'Falha na verificação; sem notificação');
    return NextResponse.json({ok:false,processed:1,status:'failed',
      error:'Scan failed for this case'},{status:503,headers});
  }
}
