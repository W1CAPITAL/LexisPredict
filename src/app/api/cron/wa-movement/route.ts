import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/server-db';
import { queueNextMovementForTenant } from '@/lib/wa-movement-campaign';
import { prepareMovementAlert } from '@/lib/wa-movement-builder';
import { contactOptedOut } from '@/lib/wa-contact-privacy';
import { queueCheckedPortfolioContact, queueOverdueContact } from '@/lib/wa-portfolio-outreach';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const noStore = { 'Cache-Control': 'private, no-store' };

function authenticated(request: Request) {
  const token = String(request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '').trim();
  // Support the Supabase vault cron token and the platform's CRON_SECRET.
  return [process.env.WA_MOVEMENT_CRON_SECRET, process.env.CRON_SECRET]
    .filter((s): s is string => typeof s === 'string' && s.length >= 16)
    .some((s) => token.length === s.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(s)));
}


/**
 * One-time recovery authorized by the tenant owner for a previously cancelled
 * batch. An old redacted message is NEVER sent. Reconstruct only from current
 * official DataJud/DJEN evidence, rechecking the fresh source proof, hash,
 * destination, opt-out and the shared deduplication ledger.
 */
async function recoverApprovedNotices(db: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  tenant: string, owner: string) {
  const { data, error } = await db.from('wa_movement_dispatches')
    .select('id,processo_id,phone,event_hash')
    .eq('empresa_id', tenant).eq('status', 'cancelled')
    .eq('last_error', 'requeue_authorized_20261014')
    .order('created_at', { ascending: true }).limit(6);
  if (error) throw new Error('Fila de recuperação indisponível');
  let queued = 0;
  for (const prior of data || []) {
    const { data: row, error: loadError } = await db.from('processos')
      .select('*').eq('empresa_id',tenant).eq('id',prior.processo_id).maybeSingle();
    const prepared = !loadError && row ? prepareMovementAlert(row, true) : null;
    const notice = prepared?.alert;
    if (!notice || notice.event_hash !== prior.event_hash ||
        notice.phone !== prior.phone || await contactOptedOut(tenant,prior.phone)) {
      // Do not retry a cancelled record with expired/ambiguous court evidence.
      await db.from('wa_movement_dispatches')
        .update({ last_error: 'requeue_skipped_source_or_preference_changed' })
        .eq('id',prior.id).eq('empresa_id',tenant)
        .eq('status','cancelled').eq('last_error','requeue_authorized_20261014');
      continue;
    }
    const { data: accepted, error: enqueueError } = await db.rpc('wa_enqueue_notice', {
      p_empresa:tenant,p_owner:owner,p_notice:notice,
    });
    if (enqueueError) throw new Error('Falha ao recuperar aviso autorizado');
    if (accepted) queued++;
    else await db.from('wa_movement_dispatches')
      .update({ last_error:'requeue_skipped_duplicate_or_owner_invalid' })
      .eq('id',prior.id).eq('empresa_id',tenant)
      .eq('status','cancelled').eq('last_error','requeue_authorized_20261014');
  }
  return queued;
}

/**
 * Background scheduler independent of UI tabs, user location and browser sessions.
 * Only authenticated server-side workers can prepare a job.
 * The connected device worker still performs the actual send and acknowledges it.
 * Atomic reservations enforce the minimum gap, opt-outs and daily limits.
 */
export async function GET(request: Request) {
  if (!authenticated(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: noStore });
  }
  try {
    const db = await getSupabaseAdmin();
    const { data: configs, error } = await db.from('wa_daily_return_settings')
      .select('empresa_id,owner_auth_id')
      .eq('enabled', true)
      .eq('consent_attested', true)
      .limit(25);
    if (error) return NextResponse.json({ ok: false, error: 'Configuração indisponível' },
      { status: 503, headers: noStore });
    const results: Array<{ tenant: string; queued: boolean; reason: string; recovered: number }> = [];
    const started = Date.now();
    for (const cfg of configs || []) {
      if (Date.now() - started > 40000) break;
      try {
        // The restored batch is strictly opt-in and selected by an explicit
        // authorization marker; normal cancellations are never restarted.
        const recovered = cfg.owner_auth_id
          ? await recoverApprovedNotices(db,cfg.empresa_id,cfg.owner_auth_id) : 0;
        // A long-running movement campaign must not starve overdue check-ins.
        // Fair scheduling: two ticks out of three go to checked overdue
        // clients first, with movements prioritized on the third tick.
        // Both flows share the same 45s lock, 120/day ceiling and opt-outs.
        const minute=Number(new Intl.DateTimeFormat('en-GB',{
          timeZone:'America/Sao_Paulo',minute:'2-digit',
        }).format(new Date()));
        const {data:tenantSettings}=await db.from('wa_daily_return_settings')
          .select('send_anytime').eq('empresa_id',cfg.empresa_id).maybeSingle();
        let next:{queued:boolean;reason?:string}|null=null;
        let checkin:{queued:boolean;reason:string}|null=null;
        if(tenantSettings?.send_anytime && minute%3!==0){
          checkin=await queueOverdueContact(cfg.empresa_id);
          if(!checkin.queued)next=await queueNextMovementForTenant(cfg.empresa_id);
        }else{
          next=await queueNextMovementForTenant(cfg.empresa_id);
          if(!next.queued && tenantSettings?.send_anytime){
            checkin=await queueOverdueContact(cfg.empresa_id);
          }else if(!next.queued){
            const {data:active}=await db.from('wa_movement_campaigns')
              .select('id').eq('empresa_id',cfg.empresa_id).eq('status','running').limit(1);
            if(!active?.length)checkin=await queueCheckedPortfolioContact(cfg.empresa_id);
          }
        }
        results.push({
          tenant:cfg.empresa_id,
          queued:next?.queued===true||checkin?.queued===true,
          reason:String((checkin?.queued ? checkin.reason : (next?.queued ? next.reason : (checkin?.reason||next?.reason))) || 'nothing_due'),
          recovered,
        });
      } catch (e) {
        console.error('[wa-movement-cron] preparation failed',
          e instanceof Error ? e.message : 'unknown');
        results.push({ tenant: cfg.empresa_id, queued: false, reason: 'preparation_failed', recovered: 0 });
      }
    }
    return NextResponse.json({
      ok: true,
      queued: results.filter((x) => x.queued).length,
      checked: results.length,
      recovered: results.reduce((sum,x)=>sum+x.recovered,0),
      reasons: results.map((x) => x.reason),
    }, { headers: noStore });
  } catch (e) {
    console.error('[wa-movement-cron] fatal', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Erro ao preparar comunicados' },
      { status: 503, headers: noStore });
  }
}
