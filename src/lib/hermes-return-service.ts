import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import { fetchDataJud, isDataJudUseAuthorized } from '@/lib/datajud';
import {getHermesNationalSourcePlan,classifyHermesOfficialFallback} from '@/lib/hermes-official-fallbacks';
import {evaluateHermesStalledEvidence} from '@/lib/hermes-stalled-evaluation';
import {buildHermesJudicialFindings} from '@/lib/hermes-judicial-findings';
import {mergeHermesCourtHistory,buildHermesVerifiedProcessPatch} from '@/lib/hermes-portfolio-evidence';
import { fetchDjenComunicacoes, resolveDjenPublicacaoLink } from '@/lib/djen';
import { fetchTJPRProjudiProcess } from '@/lib/tjpr-projudi-mni';
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
 if(!isDataJudUseAuthorized())return {error:true,errorCode:'terms_restricted',message:'DataJud desativado até autorização expressa do CNJ para o uso pretendido.'};
 const plan=getHermesNationalSourcePlan(cnj);
 if(!plan)return {error:true,errorCode:'unknown_jurisdiction',message:'Ramo/tribunal não identificado pelo número CNJ; nenhuma API incorreta será consultada.'};
 const alias=plan.alias;
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
function normalizeSourceTimestamp(value:unknown):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 const time=Date.parse(value);
 return Number.isFinite(time)?new Date(time).toISOString():null;
}

type CourtSnapshotWithDiagnostic=HermesCourtSnapshot&{
 sourceErrors:Record<'djen'|'datajud'|'fonteAlternativa'|'projudi',string|null>;
};
async function obtainCourtSnapshot(cnj:string,lastReturn:string|null,manual=false):Promise<CourtSnapshotWithDiagnostic>{
 const fromDay=validReturnDay(lastReturn);
 const beginning=fromDay
  ?new Date(Date.parse(fromDay+'T12:00:00Z')-86400000).toISOString().slice(0,10)
  :new Date(Date.now()-180*86400000).toISOString().slice(0,10);
 const [dj,djen]=await Promise.allSettled([
  requestDataJudWithCapacity(cnj,manual),
  fetchDjenComunicacoes(cnj,{
   dataInicio:beginning,cloudBudget:!manual,hermesManual:manual,
   forceRefresh:manual,hermesDualFormat:true,
  }),
 ]);
 const datajud=dj.status==='fulfilled'?dj.value:null;
 const diario=djen.status==='fulfilled'?djen.value:null;
 const datajudOk=!!datajud&&datajud.error===false&&datajud.found===true;
 const datajudUpdatedAt=datajudOk?normalizeSourceTimestamp(datajud?.dataHoraUltimaAtualizacao):null;
 const datajudIndexTimestamp=datajudOk?normalizeSourceTimestamp(datajud?.indexTimestamp):null;
 const datajudRestricted=datajud?.errorCode==='terms_restricted';
 const djenOk=!!diario&&diario.success===true;
 const events:HermesCourtEvent[]=[];
 if(datajudOk){
  const movements=Array.isArray(datajud.movimentos)?datajud.movimentos:[];
  for(const movement of movements){
   const at=eventDate(movement?.dataHora||movement?.data||movement?.dataMovimento);
   const name=String(movement?.nome||movement?.descricao||'').trim();
   const extras=(Array.isArray(movement?.complementosTabelados)?movement.complementosTabelados:[])
    .slice(0,8).map((x:any)=>[x?.nome,x?.descricao,x?.valor]
     .filter(v=>typeof v==='string'||typeof v==='number').join(': ')).filter(Boolean);
   const text=[name,...extras].filter(Boolean).join(' · ').slice(0,2400);
   if(at&&text)events.push({source:'DataJud',at,text,url:null});
  }
 }
 if(djenOk){
  for(const item of diario!.items||[]){
   if(normalizedCnj(item.numero_processo)!==cnj)continue;
   const at=validReturnDay(item.data_disponibilizacao);
   const text=String(item.texto||'').trim();
   if(!at||!text)continue;
   events.push({source:'DJEN',at,text,url:safeLink(resolveDjenPublicacaoLink(item,cnj))});
  }
 }
 const plan=getHermesNationalSourcePlan(cnj);
 const datajudHasRelevantMovement=events.some(event=>
  event.source==='DataJud'&&(!fromDay||(validReturnDay(event.at)||'')>fromDay)
 );
 // O MNI do TJPR é acionado automaticamente quando o DataJud falha ou não
 // traz movimento posterior ao último retorno. Não acessa a tela com captcha.
 const courtApiAttempted=plan?.tribunalApiAutomated===true&&(!datajudOk||!datajudHasRelevantMovement);
 let courtApiOk=false;
 let courtApiError:string|null=null;
 let courtApiSource:string|undefined=plan?.tribunalApiAutomated?'TJPR PROJUDI':undefined;
 if(courtApiAttempted){
  try{
   const alternative=await fetchTJPRProjudiProcess(cnj);
   courtApiOk=alternative.ok&&alternative.found;
   courtApiError=courtApiOk?null:alternative.message||'Consulta oficial TJPR PROJUDI MNI não confirmada.';
   if(courtApiOk){
    for(const item of alternative.events){
     const at=eventDate(item.at)||validReturnDay(item.at)||'';
     if(at&&item.text)events.push({source:'TJPR PROJUDI',at,text:item.text,url:safeLink(item.url)});
    }
   }
  }catch{
   courtApiError='Falha ao executar a integração oficial TJPR PROJUDI MNI.';
  }
 }
 const diagnostic=(msg:unknown)=>String(msg||'Falha técnica ou fonte não confirmada.')
  .replace(/[\r\n\t]/g,' ').replace(/https?:\/\/\S+/g,'endereço da fonte').slice(0,220);
 const sourceMode=classifyHermesOfficialFallback(datajudOk,djenOk);
 const sourceContext=plan?.tribunal||'tribunal não identificado';
 let fonteAlternativa:string|null=null;
 if(courtApiOk){
  fonteAlternativa=datajudOk
   ?'DataJud e TJPR PROJUDI MNI consultados; o MNI confirmou a consulta direta ao processo.'
   :'DataJud indisponível ou sem resultado nesta execução; TJPR PROJUDI MNI confirmou a consulta direta ao processo.';
 }else if(courtApiAttempted){
  fonteAlternativa='DataJud indisponível ou sem movimento novo; o Hermes acionou automaticamente o TJPR PROJUDI MNI, mas a fonte não confirmou a consulta: '+diagnostic(courtApiError);
 }else if(sourceMode==='djen-only'){
  fonteAlternativa=datajudRestricted
   ?'DJEN oficial verificado automaticamente em '+sourceContext+'; DataJud não foi acionado por restrição dos termos de uso. A consulta cobre publicações, não todas as movimentações dos autos.'
   :'DJEN oficial verificado automaticamente em '+sourceContext+'; este resultado cobre publicações, não todas as movimentações dos autos. DataJud terá nova tentativa no agendador.';
 }else if(sourceMode==='datajud-only'){
  fonteAlternativa='DataJud consultado em '+sourceContext+'; publicações do DJEN ainda precisam ser verificadas em nova execução.';
 }else if(sourceMode==='no-current-source'){
  fonteAlternativa='DJEN e DataJud indisponíveis nesta verificação de '+sourceContext+'. O Hermes mantém o caso pendente e reconsulta automaticamente; não presume ausência de movimentação.';
 }
 return {
  djenOk,datajudOk,datajudUpdatedAt,datajudIndexTimestamp,events,courtApiOk,courtApiAttempted,courtApiSource,courtApiError,
  sourceErrors:{
   djen:djenOk?null:diagnostic(djen.status==='rejected'?null:diario?.error||'Resposta da fonte não confirmada.'),
   datajud:datajudOk?null:diagnostic(dj.status==='rejected'?null:datajud?.message||'Não encontrado no índice ou fonte indisponível.'),
   projudi:courtApiAttempted&&!courtApiOk?diagnostic(courtApiError):null,
   fonteAlternativa,
  },
 };
}
async function persistResult(
  db: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  row: ProcessRow, due: string,
  result: ReturnType<typeof buildHermesReturnReview>, cnj: string,snapshot:CourtSnapshotWithDiagnostic,
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
      datajudUpdatedAt:snapshot.datajudUpdatedAt||null,
      datajudIndexTimestamp:snapshot.datajudIndexTimestamp||null,
      tribunalApi: snapshot.courtApiOk ? 'consultado' : snapshot.courtApiAttempted ? 'indisponivel' : 'nao_acionado',
      tribunalApiOk: snapshot.courtApiOk,
      tribunalApiSource: snapshot.courtApiSource || null,
      tribunalApiAttempted: snapshot.courtApiAttempted,
      origin: 'official-public-apis-and-authorized-court-mni',
      sourceMode:snapshot.courtApiOk?(snapshot.djenOk?'djen+tribunal-api':'tribunal-api-only'):classifyHermesOfficialFallback(result.datajudOk,result.djenOk),
      tribunal:getHermesNationalSourcePlan(cnj)?.tribunal||null,
      officialPortal:getHermesNationalSourcePlan(cnj)?.tribunalPortal?.url||'https://www.jus.br/',
      tribunalApiAutomated:getHermesNationalSourcePlan(cnj)?.tribunalApiAutomated===true,
      sourceErrors:snapshot.sourceErrors,
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
  let snapshot:CourtSnapshotWithDiagnostic={ djenOk:false,datajudOk:false,events:[],courtApiOk:false,courtApiAttempted:false,
    datajudUpdatedAt:null,datajudIndexTimestamp:null,
    sourceErrors:{djen:'Consulta não executada.',datajud:'Consulta não executada.',projudi:null,fonteAlternativa:null} };
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
  await persistResult(db, row, due, result, cnj,snapshot);
  if(cnj && (snapshot.djenOk||snapshot.datajudOk||snapshot.courtApiOk)){try{await persistHermesPortfolioSnapshot(db,row,snapshot);}catch{console.warn('[Hermes] Índice judicial da carteira não atualizado.');}}
  // Hermes atua como verificador oficial também da pauta; nenhuma mensagem é enviada.
  if (snapshot.djenOk || snapshot.datajudOk || snapshot.courtApiOk) {
    try {
      const { atualizarAudienciasDeConsulta } = await import('@/lib/audiencias-service');
      const fontes = snapshot.events.map((event) => ({
        source: event.source,
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
  // Processos parados executam em agenda própria: a fila de retornos não pode bloqueá-los.
  return { ok: true, processed: results.length, results, elapsedMs: Date.now() - started };
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
   courtApiOk:false,courtApiAttempted:false,
   sourceErrors:{djen:'CNJ inválido',datajud:'CNJ inválido',projudi:null,fonteAlternativa:'Número CNJ inválido. Verificação automática não executada.'}
  };
  // DataJud guarda movimentações; DJEN guarda publicações, sem presunção de equivalência.
  const verified=evaluateHermesStalledEvidence({
   today,djenOk:snapshot.djenOk,datajudOk:snapshot.datajudOk,courtApiOk:snapshot.courtApiOk,
   events:snapshot.events,
   lastKnownDataJudMove:row.datajud_last_ok===true?validReturnDay(row.datajud_ultimo_movimento):null,
   lastKnownDjenPublication:row.djen_last_ok===true?validReturnDay(row.djen_ultima_data):null,
  });
  const state=verified.state;
  const last=verified.lastMovementAt;
  const daysWithoutMovement=verified.daysWithoutMovement;
  const checkedAt=new Date().toISOString();
  const {data:priorStalled}=await db.from('hermes_stalled_reviews')
   .select('tribunal_api_ok,tribunal_api_source,tribunal_api_checked_at')
   .eq('empresa_id',company).eq('processo_id',processId).maybeSingle();
  const evidence=snapshot.events
   .filter(e=>e.at&&e.text)
   .sort((a,b)=>b.at.localeCompare(a.at))
   .slice(0,8).map(e=>({source:e.source,at:e.at,text:e.text.slice(0,320),url:e.url}));
  const {error:saveError}=await db.from('hermes_stalled_reviews').upsert({
   empresa_id:company,processo_id:processId,state,
   checked_at:checkedAt,attempted_at:checkedAt,
   last_movement_at:last,days_without_movement:daysWithoutMovement,
   djen_ok:snapshot.djenOk,datajud_ok:snapshot.datajudOk,
   tribunal_api_ok:snapshot.courtApiAttempted?snapshot.courtApiOk===true:priorStalled?.tribunal_api_ok===true,
   tribunal_api_source:snapshot.courtApiSource||priorStalled?.tribunal_api_source||null,
   tribunal_api_checked_at:snapshot.courtApiAttempted?checkedAt:priorStalled?.tribunal_api_checked_at||null,
   source_errors:{...snapshot.sourceErrors,ultimaPublicacaoDjen:verified.lastPublicationAt},evidence,
  },{onConflict:'empresa_id,processo_id'});
  if(saveError)throw saveError;
  try{await persistHermesPortfolioSnapshot(db,row,snapshot as CourtSnapshotWithDiagnostic);}
  catch{console.warn('[Hermes] Índice judicial da carteira não atualizado na revisão de parados.');}
  return {processed:1,state};
 }catch{
  await db.from('hermes_stalled_reviews').update({
   state:'unavailable',checked_at:new Date().toISOString(),
   source_errors:{system:'A investigação judicial não pôde ser concluída.'}
  }).eq('empresa_id',company).eq('processo_id',processId);
  return {processed:1,state:'unavailable' as const};
 }
}


/** Um dossiê oficial rastreável por processo e empresa.
 * "ready" significa DJEN e uma fonte de movimento (DataJud ou MNI), jamais autos integrais.
 * Nunca atualiza retorno, mérito administrativo, cobrança ou mensagem ao cliente.
 */
export async function persistHermesPortfolioSnapshot(
 db:Awaited<ReturnType<typeof getSupabaseAdmin>>,
 row:ProcessRow,snapshot:CourtSnapshotWithDiagnostic
){
 const now=new Date().toISOString();
 // Partial retries must NEVER discard the older verified source.
 const {data:prior,error:readError}=await db.from('hermes_portfolio_scans')
  .select('events,tribunal_api_ok,tribunal_api_source,tribunal_api_checked_at')
  .eq('empresa_id',row.empresa_id).eq('processo_id',row.id).maybeSingle();
 if(readError)throw new Error('Falha ao preservar histórico judicial anterior: '+readError.code);
 const events=mergeHermesCourtHistory(
  Array.isArray(prior?.events)?prior.events as HermesCourtEvent[]:[],
  snapshot.events
 );
 const findings={...buildHermesJudicialFindings(events),datajudFreshness:snapshot.datajudOk?{
  updatedAt:snapshot.datajudUpdatedAt||null,indexTimestamp:snapshot.datajudIndexTimestamp||null,
 }:null};
 const movementSourceOk=snapshot.datajudOk||snapshot.courtApiOk===true;
 const state:'ready'|'partial'|'unavailable'=
  snapshot.djenOk&&movementSourceOk?'ready':
  snapshot.djenOk||movementSourceOk?'partial':'unavailable';
 const {error}=await db.from('hermes_portfolio_scans').upsert({
  empresa_id:row.empresa_id,processo_id:row.id,state,
  checked_at:now,attempted_at:now,datajud_ok:snapshot.datajudOk,djen_ok:snapshot.djenOk,
  tribunal_api_ok:snapshot.courtApiAttempted?snapshot.courtApiOk===true:prior?.tribunal_api_ok===true,
  tribunal_api_source:snapshot.courtApiSource||prior?.tribunal_api_source||null,
  tribunal_api_checked_at:snapshot.courtApiAttempted?now:prior?.tribunal_api_checked_at||null,
  last_court_movement_at:findings.latestCourtMovement,
  last_datajud_movement_at:(snapshot.events.filter(e=>e.source==='DataJud').map(e=>validReturnDay(e.at)).filter((v):v is string=>!!v).sort().at(-1)||null),
  last_djen_publication_at:findings.latestDjenPublication,
  source_errors:snapshot.sourceErrors,events,findings,
 },{onConflict:'empresa_id,processo_id'});
 if(error)throw new Error('Falha ao gravar histórico oficial Hermes: '+error.code);
 // Only verified DataJud or authorized tribunal API movements can change the CRM's
 // generic last-court-movement date. DJEN publication dates never do.
 const patch=buildHermesVerifiedProcessPatch({
  snapshot,checkedAt:now,
  lastDataJudMovement:row.datajud_ultimo_movimento,
  lastMovement:row.ultima_movimentacao,
  lastDjenPublication:row.djen_ultima_data,
 });
 let crmSynced=true;
 if(Object.keys(patch).length){
  const {error:syncError}=await db.from('processos').update(patch)
   .eq('empresa_id',row.empresa_id).eq('id',row.id);
  if(syncError){crmSynced=false;console.warn('[Hermes carteira] Atualização de movimentos CRM falhou:',syncError.code);}
 }
 return {state,eventsSaved:events.length,hearings:findings.hearings.length,crmSynced};
}

/** A carteira inteira é elegível: nenhuma condição de "parado" ou retorno.
 * Agendamento incremental e controle de capacidade do DataJud permanecem ativos.
 */
export async function runHermesPortfolioScanBatch(){
 const db=await getSupabaseAdmin();
 const {data,error}=await db.rpc('hermes_claim_portfolio_scan_batch',{
  p_today:brazilToday(),p_limit:2,
 });
 if(error)throw new Error('Fila de carteira judicial indisponível: '+error.message);
 const claims=(Array.isArray(data)?data:[]) as Array<{empresa_id:string;processo_id:number}>;
 if(!claims.length)return {processed:0,state:'empty' as const,officialEvents:0,hearings:0};

 // Duas consultas independentes por minuto. O limitador DataJud continua
 // controlando a capacidade por tribunal; a consulta DJEN de cada processo
 // segue mesmo quando o DataJud está em cooldown.
 const results=await Promise.all(claims.map(async claim=>{
  const company=String(claim.empresa_id),processId=Number(claim.processo_id);
  try{
   const row=await loadHermesReviewCase(db,company,processId);
   if(!row)throw new Error('Processo não acessível pela empresa.');
   const cnj=normalizedCnj(row.protocolo_ref||row.dados?.protocolo);
   if(!cnj)throw new Error('CNJ incompleto.');
   const snapshot=await obtainCourtSnapshot(cnj,null,false);
   const output=await persistHermesPortfolioSnapshot(db,row,snapshot);
   // Reaproveitar o índice de audiências existente para /audiencias e /agenda.
   if(snapshot.djenOk||snapshot.datajudOk||snapshot.courtApiOk){
    try{
     const {atualizarAudienciasDeConsulta}=await import('@/lib/audiencias-service');
     const fontes=snapshot.events.map(e=>({source:e.source,text:e.text,url:e.url,publishedAt:e.at}));
     const hearings=await atualizarAudienciasDeConsulta({
      empresaId:company,processoId:processId,fontes,
     });
     if(!hearings.ok)console.warn('[Hermes carteira] Falha ao indexar audiências confirmadas.');
    }catch{console.warn('[Hermes carteira] Índice de audiências não atualizado.');}
   }
   return {
    processId,processed:1,state:output.state,
    officialEvents:output.eventsSaved,hearings:output.hearings,
   };
  }catch{
   try{
    await db.from('hermes_portfolio_scans').update({
     state:'unavailable',checked_at:new Date().toISOString(),attempted_at:new Date().toISOString(),
     source_errors:{system:'Não foi possível concluir esta verificação oficial; nenhum andamento foi presumido.'},
    }).eq('empresa_id',company).eq('processo_id',processId);
   }catch{console.warn('[Hermes carteira] Não foi possível registrar a falha da consulta.');}
   return {processId,processed:1,state:'unavailable' as const,officialEvents:0,hearings:0};
  }
 }));
 const state=results.every(r=>r.state==='ready')?'ready':
  results.every(r=>r.state==='unavailable')?'unavailable':'partial';
 return {
  processed:results.length,state,
  officialEvents:results.reduce((sum,r)=>sum+r.officialEvents,0),
  hearings:results.reduce((sum,r)=>sum+r.hearings,0),
  results,
 };
}
