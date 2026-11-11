'use server';
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { reviewHermesCase, loadHermesReviewCase } from '@/lib/hermes-return-service';
import {classifyHermesReturnDate} from '@/lib/hermes-return-date';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {describeCourtScanner,type CourtScannerView} from '@/lib/hermes-court-scanner-view';

async function authorize(processId?: number, canWrite = false) {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id || (canWrite && ctx.isViewer)) {
    throw new Error('Acesso não autorizado à revisão dos retornos.');
  }
  if (processId !== undefined && (!Number.isSafeInteger(processId) || processId <= 0)) {
    throw new Error('Processo inválido.');
  }
  return { empresaId: ctx.empresa_id, authId: ctx.auth_id };
}

export async function getHermesReturnReviewAction(processId: number) {
  try {
    const { empresaId } = await authorize(processId);
    const db = await getSupabaseAdmin();
    const row = await loadHermesReviewCase(db, empresaId, processId);
    if (!row) return { ok: false as const, error: 'Processo não localizado nesta empresa.' };
    const { data, error } = await db.from('hermes_return_reviews')
      .select('id,processo_id,due_on,state,attempted_at,checked_at,djen_ok,datajud_ok,priority_score,priority_label,highlights,message_draft,suggested_next_return,source_snapshot')
      .eq('empresa_id', empresaId).eq('processo_id', processId)
      .order('due_on', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error('A revisão judicial está indisponível.');
    // Metadados públicos de fonte autorizada: nunca inferir movimentações por
    // WSDL HTTP 200 e nunca consultar processo de outra empresa.
    const cnj=String(row.protocolo_ref||'').replace(/\D/g,'');
    const adapter=cnj.length===20?({'816':'tjpr-scmpp','817':'tjpe-mni'} as Record<string,string>)[cnj.slice(13,16)]:null;
    let courtScanner:ReturnType<typeof describeCourtScanner>|null=null;
    let courtScannerDetails:CourtScannerView|null=null;
    if(adapter){
      const [own,lastIssue]=await Promise.all([
        db.from('hermes_tribunal_public_movements')
          .select('adapter,status,checked_at,next_allowed_at,movements_verified_at,http_status,movements')
          .eq('empresa_id', empresaId).eq('processo_id',processId).maybeSingle(),
        db.from('hermes_tribunal_public_movements')
          .select('status,checked_at')
          .eq('empresa_id', empresaId).eq('adapter',adapter)
          .in('status',['unavailable','timeout','rate_limited','restricted','unexpected_response','cnj_mismatch'])
          .order('checked_at',{ascending:false}).limit(1).maybeSingle(),
      ]);
      if(!own.error&&!lastIssue.error){
        const latest=own.data;
        const issue=lastIssue.data;
        const issueHours:Record<string,number>={
          unavailable:4,rate_limited:4,timeout:3,
          restricted:24,unexpected_response:24,cnj_mismatch:24,
        };
        const checked=Date.parse(String(issue?.checked_at||''));
        const issueHoursNow=issueHours[String(issue?.status||'')]||0;
        const pauseEnd=Number.isFinite(checked)&&issueHoursNow>0
          ?new Date(checked+issueHoursNow*3600000).toISOString():null;
        courtScannerDetails={
          adapter,status:String(latest?.status||'pending'),
          checkedAt:latest?.checked_at||null,
          verifiedAt:latest?.movements_verified_at||null,
          nextAllowedAt:latest?.next_allowed_at||null,
          httpStatus:typeof latest?.http_status==='number'?latest.http_status:null,
          movements:Array.isArray(latest?.movements)?latest.movements.length:0,
          sourceIssueUntil:pauseEnd,
        };
        courtScanner=describeCourtScanner(courtScannerDetails);
      }
    }
    return { ok: true as const, review: data || null, courtScanner,courtScannerDetails,
      protocolo: row.protocolo_ref, nextReturnRegistered: row.proximo_retorno, lastReturnRegistered: row.ultimo_retorno,
      returnDateStatus:classifyHermesReturnDate(row.ultimo_retorno,row.proximo_retorno,brazilToday()),
    };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Falha ao carregar revisão.' }; }
}

export async function refreshHermesReturnReviewAction(processId: number) {
  try {
    const { empresaId } = await authorize(processId, true);
    const db = await getSupabaseAdmin();
    const row = await loadHermesReviewCase(db, empresaId, processId);
    if (!row) throw new Error('Processo não localizado nesta empresa.');
    const { data: recent } = await db.from('hermes_return_reviews')
      .select('checked_at,state,djen_ok,datajud_ok')
      .eq('empresa_id', empresaId).eq('processo_id', processId)
      .order('attempted_at', { ascending: false }).limit(1).maybeSingle();
    if (recent?.checked_at && Date.now() - Date.parse(recent.checked_at) < (recent.djen_ok === true && recent.datajud_ok === true ? 15 : 2) * 60 * 1000) {
      return { ok: true as const, reused: true };
    }
    const result = await reviewHermesCase({ empresaId, processId, mode: 'manual' });
    return result.ok ? { ok: true as const, reused: false } : { ok: false as const, error: 'Não foi possível revisar este processo.' };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Falha na consulta.' }; }
}

/** Fila da empresa por urgência, não inclui clientes de outra empresa. */
export async function getHermesPriorityQueueAction() {
  try {
    const { empresaId } = await authorize();
    const db = await getSupabaseAdmin();
    const { data, error } = await db.from('hermes_return_reviews')
      .select('processo_id,due_on,state,checked_at,priority_score,priority_label,highlights,suggested_next_return')
      .eq('empresa_id', empresaId)
      .in('state', ['ready', 'partial', 'unavailable'])
      .order('priority_score', { ascending: false })
      .order('due_on', { ascending: true }).limit(200);
    if (error) throw new Error('Fila de retornos indisponível.');
    const ids = Array.from(new Set((data || []).map((r) => Number(r.processo_id))));
    if (!ids.length) return { ok: true as const, items: [] };
    const { data: processRows, error: processError } = await db.from('processos')
      .select('id,cliente,protocolo_ref,ultimo_retorno,proximo_retorno,empresa_id,status,status_interno,dados')
      .eq('empresa_id', empresaId).in('id', ids);
    if (processError) throw new Error('Não foi possível localizar os processos da fila.');
    const byId = new Map((processRows || []).map((row) => [Number(row.id), row]));
    const seen = new Set<number>();
    const items = (data || []).flatMap((r) => {
      const processId = Number(r.processo_id);
      const process = byId.get(processId);
      if (!process || seen.has(processId)) return [];
      // A revisão antiga pode existir após um contato manual: nunca mostrá-la como vencimento atual.
      if (String(process.proximo_retorno || '') !== String(r.due_on)) return [];
      const timing=classifyHermesReturnDate(process.ultimo_retorno,process.proximo_retorno,brazilToday());
      if(timing!=='overdue'&&timing!=='today')return [];
      if(/ENCERRAD|ARQUIVAD|FINALIZAD|EXTINT/i.test(String(process.status_interno||'')+' '+String(process.status||'')+' '+String((process.dados as any)?.situacao||'')))return [];
      seen.add(processId);
      return [{
        processId, cliente: String(process.cliente || 'Sem nome'),
        protocolo: String(process.protocolo_ref || ''), dueOn: String(r.due_on),
        state: String(r.state), priorityScore: Number(r.priority_score || 0),
        priorityLabel: String(r.priority_label || ''), checkedAt: String(r.checked_at || ''),
        suggestedNextReturn: String(r.suggested_next_return || ''),
        topHighlight: ((r.highlights as any[]) || []).find((h: any) => h.kind === 'new')?.text || '',
      }];
    });
    return { ok: true as const, items };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Falha na fila.' }; }
}
