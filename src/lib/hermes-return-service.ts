import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import { fetchDataJud, resolveDataJudAlias } from '@/lib/datajud';
import { fetchDjenComunicacoes, resolveDjenPublicacaoLink } from '@/lib/djen';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { brazilToday, validReturnDay } from '@/lib/wa-daily-return-policy';
import {classifyHermesReturnDate} from '@/lib/hermes-return-date';
import { buildHermesReturnReview, type HermesCourtEvent, type HermesCourtSnapshot } from '@/lib/hermes-return-policy';

type ProcessRow = {
  id: number; empresa_id: string; cliente: string | null; protocolo_ref: string | null;
  ultimo_retorno: string | null; proximo_retorno: string | null;
  status_interno: string | null; status: string | null;
  dados: Record<string, unknown> | null;
  ultima_movimentacao: string | null; datajud_ultimo_movimento: string | null;
  datajud_last_ok: boolean | null; djen_last_ok: boolean | null; djen_ultima_data: string | null;
};
type Claim = { empresa_id: string; processo_id: number; due_on: string };

function normalizedCnj(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length === 20 ? digits : '';
}
function eventDate(value: unknown): string {
  const raw = String(value || '');
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return '';
  return /T\d\d:\d\d/.test(raw) ? brazilToday(new Date(parsed)) : (validReturnDay(raw) || '');
}
function safeLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'comunica.pje.jus.br' || url.hostname.endsWith('.jus.br')) ? url.href : null;
  } catch { return null; }
}
export async function loadHermesReviewCase(db: Awaited<ReturnType<typeof getSupabaseAdmin>>, empresaId: string, processId: number) {
  const { data, error } = await db.from('processos')
    .select('id,empresa_id,cliente,protocolo_ref,ultimo_retorno,proximo_retorno,status_interno,status,dados,ultima_movimentacao,datajud_ultimo_movimento,datajud_last_ok,djen_last_ok,djen_ultima_data')
    .eq('empresa_id', empresaId).eq('id', processId).maybeSingle();
  if (error) throw new Error('Falha ao consultar processo do tenant.');
  return (data || null) as ProcessRow | null;
}

/** DataJud is capacity limited independently of DJEN.
 * Reservations use Postgres as a cross-instance circuit breaker, not process memory.
 * The CNJ can return 429 due to an overloaded Elasticsearch queue.
 */
async function requestDataJudWithCapacity(cnj:string,manual:boolean):Promise<any>{
 const alias=resolveDataJudAlias(cnj);
 const db=await getSupabaseAdmin();
 const {data:slots,error:reservationError}=await db.rpc('hermes_reserve_datajud_slot',{p_alias:alias});
 if(reservationError) {
  return {error:true,errorCode:'capacity_unavailable',message:'Controle de consultas DataJud indisponível; fonte ainda não confirmada.'};
 }
 const slot=(Array.isArray(slots)?slots[0]:slots) as {allowed?:boolean;retry_at?:string}|null;
 if(!slot?.allowed){
  const retry=slot?.retry_at?new Date(slot.retry_at):null;
  const at=retry&&!Number.isNaN(retry.getTime())
   ?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(retry)
   :'próxima janela disponível';
  return {error:true,errorCode:'cooldown',
   message:`DataJud em pausa para respeitar os limites da API oficial. Nova tentativa após ${at}.`};
 }
 let result:any;
 try{
  result=await fetchDataJud(cnj, 1, {
   fast: true, cloudBudget: true, forceRefresh: manual, timeoutMs: manual?44_000:38_000,
  });
 }catch(error){
  result={error:true,errorCode:'network_error',
   message:'Consulta DataJud indisponível por falha de comunicação.'};
 }
 const outcome=result?.error!==true
  ?(result?.found===true?'ok':'not_found')
  :result?.httpStatus===429||result?.errorCode==='rate_limited'?'rate_limited'
  :result?.errorCode==='timeout'?'timeout'
  :result?.errorCode==='index_timeout'?'index_timeout'
  :result?.httpStatus===401||result?.httpStatus===403?'auth_error'
  :result?.httpStatus>=500||result?.errorCode==='shard_failure'?'server_error'
  :'other_error';
 const retryAfterSeconds=Number.isFinite(result?.retryAfterSeconds)?Math.max(0,Math.trunc(result.retryAfterSeconds)):null;
 const {error:finishError}=await db.rpc('hermes_finish_datajud_slot',{
  p_alias:alias,p_outcome:outcome,p_retry_after_seconds:retryAfterSeconds,
 });
 if(finishError) console.warn('[Hermes] Falha no registro do limite DataJud:',finishError.code||'unavailable');
 return result;
}

/** Independent court verification: no WhatsApp queue and no changes to process or return dates. */
type CourtSnapshotWithDiagnostic=HermesCourtSnapshot&{sourceErrors:Record<'djen'|'datajud',string|null>};
async function obtainCourtSnapshot(cnj: string, lastReturn: string | null,manual=false): Promise<CourtSnapshotWithDiagnostic> {
  const fromDay = validReturnDay(lastReturn);
  const beginning = fromDay
    ? new Date(Date.parse(fromDay + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [dj, djen] = await Promise.allSettled([
    requestDataJudWithCapacity(cnj,manual),
    fetchDjenComunicacoes(cnj, { dataInicio: beginning, cloudBudget: !manual, hermesManual: manual, forceRefresh: manual }),
  ]);
  const datajud = dj.status === 'fulfilled' ? dj.value : null;
  const diario = djen.status === 'fulfilled' ? djen.value : null;
  const datajudOk = !!datajud && datajud.error === false && datajud.found === true;
  const djenOk = !!diario && diario.success === true;
  const events: HermesCourtEvent[] = [];
  if (datajudOk) {
    const movements = Array.isArray(datajud.movimentos) ? datajud.movimentos : [];
    for (const movement of movements) {
      const at = eventDate(movement?.dataHora || movement?.data || movement?.dataMovimento);
      const text = String(movement?.nome || movement?.descricao || '').trim();
      if (at && text) events.push({ source: 'DataJud', at, text, url: null });
    }
  }
  if (djenOk) {
    for (const item of diario!.items || []) {
      if (normalizedCnj(item.numero_processo) !== cnj) continue;
      const at = validReturnDay(item.data_disponibilizacao);
      const text = String(item.texto || '').trim();
      if (!at || !text) continue;
      events.push({
        source: 'DJEN', at, text,
        url: safeLink(resolveDjenPublicacaoLink(item, cnj)),
      });
    }
  }
  const diagnostic=(msg:unknown)=>String(msg||'Falha técnica ou fonte não confirmada.')
    .replace(/[\r\n\t]/g,' ').replace(/https?:\/\/\S+/g,'endereço da fonte').slice(0,150);
  return { djenOk, datajudOk, events,sourceErrors:{
    djen:djenOk?null:diagnostic(djen.status==='rejected'?null:diario?.error||'Resposta da fonte não confirmada.'),
    datajud:datajudOk?null:diagnostic(dj.status==='rejected'?null:datajud?.message||'Não encontrado no índice ou fonte indisponível.'),
  }};
}
async function persistResult(
  db: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  row: ProcessRow, due: string,
  result: ReturnType<typeof buildHermesReturnReview>, cnj: string,sourceErrors:Record<string,string|null>,
) {
  const now = new Date().toISOString();
  const { error } = await db.from('hermes_return_reviews').upsert({
    empresa_id: row.empresa_id, processo_id: row.id, due_on: due,
    state: result.state, checked_at: now, attempted_at: now,
    djen_ok: result.djenOk, datajud_ok: result.datajudOk,
    priority_score: result.priorityScore, priority_label: result.priorityLabel,
    highlights: result.highlights, message_draft: result.messageDraft,
    suggested_next_return: result.suggestedNextReturn,
    source_snapshot: {
      cnj, checkedAt: now,
      djen: result.djenOk ? 'consultado' : 'indisponivel',
      datajud: result.datajudOk ? 'consultado' : 'indisponivel',
      origin: 'official-public-apis',
      sourceErrors,
    },
  }, { onConflict: 'empresa_id,processo_id,due_on' });
  if (error) throw new Error('Falha ao registrar revisão judicial: ' + error.message);
}

/** Scheduler supplies a claimed (tenant,process,scheduled day); manual action also uses this path. */
export async function reviewHermesCase(input: {
  empresaId: string; processId: number; dueOn?: string; mode?: 'manual' | 'scheduled';
}) {
  const db = await getSupabaseAdmin();
  const row = await loadHermesReviewCase(db, input.empresaId, input.processId);
  if (!row) return { ok: false as const, reason: 'not_found' };
  const today = brazilToday();
  // Manual early checks must not satisfy the future scheduled return claim.
  // A due/overdue manual check may reuse the current scheduled date.
  const scheduled = validReturnDay(row.proximo_retorno);
  const scheduleState=classifyHermesReturnDate(row.ultimo_retorno,row.proximo_retorno,today);
  const due = validReturnDay(input.dueOn) ||
    (scheduled && (scheduleState==='today'||scheduleState==='overdue') ? scheduled : today);
  const cnj = normalizedCnj(row.protocolo_ref || row.dados?.protocolo);
  const name = row.cliente || String(row.dados?.cliente || '');
  const manual=input.mode==='manual';
  let snapshot:CourtSnapshotWithDiagnostic={ djenOk:false,datajudOk:false,events:[],
    sourceErrors:{djen:'Consulta não executada.',datajud:'Consulta não executada.'} };
  if (cnj && !isCasoEncerrado(row)) snapshot = await obtainCourtSnapshot(cnj, row.ultimo_retorno,manual);
  const result = buildHermesReturnReview({
    cliente: name, protocolo: row.protocolo_ref || cnj,
    ultimoRetorno: row.ultimo_retorno, proximoRetorno: row.proximo_retorno,
    status: isCasoEncerrado(row) ? 'ENCERRADO' : String(row.status_interno || row.status || ''),
    today,
  }, snapshot);
  if (!cnj && result.state !== 'skipped') {
    result.state = 'unavailable';
    result.messageDraft = null;
    result.highlights.unshift({
      source: 'Sistema', date: null, text: 'CNJ inválido ou ausente: não foi possível consultar as fontes oficiais.',
      kind: 'gap', url: null,
    });
  }
  if(scheduleState==='inconsistent'){
    result.highlights.unshift({source:'Sistema',date:null,kind:'gap',url:null,
      text:'Data de próximo retorno incompatível com o último atendimento: requer correção no cadastro; não é retorno vencido.'});
  }
  await persistResult(db, row, due, result, cnj,snapshot.sourceErrors);
  // Hermes atua como verificador oficial também da pauta; nenhuma mensagem é enviada.
  if (snapshot.djenOk || snapshot.datajudOk) {
    try {
      const { atualizarAudienciasDeConsulta } = await import('@/lib/audiencias-service');
      const fontes = snapshot.events.map((event) => ({
        source: event.source === 'DJEN' ? 'DJEN' as const : 'DataJud' as const,
        text: event.text, url: event.url, publishedAt: event.at,
      }));
      const aud = await atualizarAudienciasDeConsulta({
        empresaId: input.empresaId, processoId: row.id, fontes,
      });
      if (!aud.ok) console.warn('[Hermes] agenda judicial indisponível',aud.error);
    } catch(error) {
      console.warn('[Hermes] agenda judicial falhou',error instanceof Error?error.message:'erro');
    }
  }
  return { ok: true as const, processId: row.id, state: result.state, score: result.priorityScore };
}

/** Incremental microbatch; called by authenticated server scheduler, never sends messages. */
export async function runHermesDueReviewBatch(maxCases = 2) {
  const started = Date.now();
  const db = await getSupabaseAdmin();
  const today = brazilToday();
  const results: Array<{ processId: number; state: string }> = [];
  for (let index = 0; index < Math.min(3, Math.max(1, maxCases)); index++) {
    if (Date.now() - started > 34000) break;
    const { data, error } = await db.rpc('hermes_claim_due_review', { p_today: today });
    if (error) throw new Error('Não foi possível selecionar processos vencidos para consulta.');
    const claim = ((data || []) as Claim[])[0];
    if (!claim) break;
    try {
      const reviewed = await reviewHermesCase({
        empresaId: claim.empresa_id, processId: Number(claim.processo_id), dueOn: claim.due_on,
      });
      results.push({ processId: Number(claim.processo_id), state: reviewed.ok ? reviewed.state : 'unavailable' });
      if (!reviewed.ok) {
        await db.from('hermes_return_reviews').update({ state: 'unavailable', checked_at: new Date().toISOString() })
          .eq('empresa_id', claim.empresa_id).eq('processo_id', claim.processo_id).eq('due_on', claim.due_on);
      }
    } catch {
      await db.from('hermes_return_reviews').update({ state: 'unavailable', checked_at: new Date().toISOString() })
        .eq('empresa_id', claim.empresa_id).eq('processo_id', claim.processo_id).eq('due_on', claim.due_on);
      results.push({ processId: Number(claim.processo_id), state: 'unavailable' });
    }
  }
  // A ronda de parados só usa um turno do cron quando não há retorno vencido a revisar.
  const stalled=results.length===0&&Date.now()-started<3000
    ?await runHermesStalledReviewBatch()
    :{processed:0,state:'deferred' as const};
  return { ok: true, processed: results.length, results, stalled, elapsedMs: Date.now() - started };
}

/** A falta de movimentação é monitorada independentemente do retorno administrativo.
 * Sem ato judicial recente confirmado, não se gera mensagem nem prazo ao cliente.
 * O mesmo cron existente executa até uma investigação adicional por rodada.
 */
export async function runHermesStalledReviewBatch(){
 const db=await getSupabaseAdmin();
 const today=brazilToday();
 const {data,error}=await db.rpc('hermes_claim_stalled_review',{p_today:today});
 if(error)throw new Error('Fila automática de processos parados indisponível: '+error.message);
 const claim=(data||[])[0] as {empresa_id:string;processo_id:number}|undefined;
 if(!claim)return {processed:0,state:'empty' as const};
 const company=String(claim.empresa_id),processId=Number(claim.processo_id);
 try{
  const row=await loadHermesReviewCase(db,company,processId);
  if(!row||isCasoEncerrado(row)) {
   await db.from('hermes_stalled_reviews').update({
    state:'unavailable',checked_at:new Date().toISOString(),source_errors:{system:'Processo ausente ou encerrado; nenhuma consulta realizada.'}
   }).eq('empresa_id',company).eq('processo_id',processId);
   return {processed:1,state:'unavailable' as const};
  }
  const cnj=normalizedCnj(row.protocolo_ref||row.dados?.protocolo);
  const snapshot=cnj?await obtainCourtSnapshot(cnj,null,false):{
   djenOk:false,datajudOk:false,events:[] as HermesCourtEvent[],
   sourceErrors:{djen:'CNJ inválido',datajud:'CNJ inválido'}
  };
  const candidates=snapshot.events.map(x=>validReturnDay(x.at)).filter((x):x is string=>!!x);
  // Registros antigos só servem como evidência se a fonte correspondente foi confirmada.
  if(row.datajud_last_ok===true){
   const dated=validReturnDay(row.datajud_ultimo_movimento);
   if(dated)candidates.push(dated);
  }
  if(row.djen_last_ok===true){
   const dated=validReturnDay(row.djen_ultima_data);
   if(dated)candidates.push(dated);
  }
  candidates.sort();
  const last=candidates.length?candidates[candidates.length-1]:null;
  const daysWithoutMovement=last?Math.max(0,Math.floor(
   (Date.parse(today+'T12:00:00Z')-Date.parse(last+'T12:00:00Z'))/86400000)):null;
  const complete=snapshot.djenOk&&snapshot.datajudOk;
  const state: 'confirmed_idle'|'recent_movement'|'no_dated_movement'|'partial'|'unavailable'=
   !snapshot.djenOk&&!snapshot.datajudOk?'unavailable':
   !complete?'partial':
   daysWithoutMovement===null?'no_dated_movement':
   daysWithoutMovement>=15?'confirmed_idle':'recent_movement';
  const checkedAt=new Date().toISOString();
  const evidence=snapshot.events
   .filter(e=>e.at&&e.text)
   .sort((a,b)=>b.at.localeCompare(a.at))
   .slice(0,8).map(e=>({source:e.source,at:e.at,text:e.text.slice(0,320),url:e.url}));
  const {error:saveError}=await db.from('hermes_stalled_reviews').upsert({
   empresa_id:company,processo_id:processId,state,
   checked_at:checkedAt,attempted_at:checkedAt,
   last_movement_at:last,days_without_movement:daysWithoutMovement,
   djen_ok:snapshot.djenOk,datajud_ok:snapshot.datajudOk,
   source_errors:snapshot.sourceErrors,evidence,
  },{onConflict:'empresa_id,processo_id'});
  if(saveError)throw saveError;
  return {processed:1,state};
 }catch{
  await db.from('hermes_stalled_reviews').update({
   state:'unavailable',checked_at:new Date().toISOString(),
   source_errors:{system:'A investigação judicial não pôde ser concluída.'}
  }).eq('empresa_id',company).eq('processo_id',processId);
  return {processed:1,state:'unavailable' as const};
 }
}
