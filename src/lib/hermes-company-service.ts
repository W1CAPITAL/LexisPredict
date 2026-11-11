import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import {buildHermesVerifiedMeeting} from '@/lib/hermes-verified-meeting';
import type {HermesOfficeEvent} from '@/lib/hermes-agent-route';
import {normalizeHermesDiagnostics,type HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
import {classifyHermesReturnDate} from '@/lib/hermes-return-date';
import {brazilToday} from '@/lib/wa-daily-return-policy';
import {
  buildHermesOfficeIntelligence,
  sanitizeHermesMeetingOutput,describeHermesCaseHealth,
  type HermesCaseHealth,type HermesOfficeMetrics,
} from '@/lib/hermes-company-intelligence';

export function todayHermesBrazil():string {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const find=(key:string)=>parts.find(p=>p.type===key)?.value||'';
 return `${find('year')}-${find('month')}-${find('day')}`;
}
export type HermesOfficeDailyRow={
  empresa_id:string;day:string;metrics:HermesOfficeMetrics;meeting_note:string|null;
  meeting_engine:string|null;meeting_status:string;updated_at:string;
  meeting_error_code?:string|null;meeting_attempts?:number;meeting_claimed_at?:string|null;
};

export async function getHermesCompanyDaily(empresaId:string):Promise<HermesOfficeDailyRow|null>{
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('hermes_office_daily')
   .select('empresa_id,day,metrics,meeting_note,meeting_engine,meeting_status,meeting_error_code,meeting_attempts,meeting_claimed_at,updated_at')
   .eq('empresa_id',empresaId).order('day',{ascending:false}).limit(1).maybeSingle();
 if(error)throw Error('O painel Hermes não conseguiu ler o resumo diário.');
 const row=data as HermesOfficeDailyRow|null;
 if(row?.metrics && (row.meeting_status==='ready'||row.meeting_status==='unavailable')){
   // Show current evidence rather than a stale free-model note, even if figures changed today.
   const evidence=await getHermesPortfolioDiagnostics(empresaId).catch(()=>null);
   return {...row,meeting_note:buildHermesVerifiedMeeting(row.metrics,row.day,evidence),
     meeting_engine:'auditoria-evidencias-v2',meeting_status:'ready'};
 }
 return row;
}


export type HermesRebuildRun={
 id:number;empresa_id:string;day:string;state:'audited'|'no_changes';
 input_metrics:HermesOfficeMetrics;
 recommendations:Array<{sector:string;action:string;evidence:number;automated:boolean;status:string}>;
 findings_count:number;evidence_count:number;recorded_at:string;
};
/** Only authenticated office handlers may request the enterprise-scoped evidence. */
export async function getHermesRebuildRuns(empresaId:string):Promise<HermesRebuildRun[]>{
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('hermes_rebuild_runs')
   .select('id,empresa_id,day,state,input_metrics,recommendations,findings_count,evidence_count,recorded_at')
   .eq('empresa_id',empresaId).order('recorded_at',{ascending:false}).limit(4);
 if(error)throw Error('O histórico de autoavaliação Hermes não pôde ser carregado.');
 return (data||[]) as HermesRebuildRun[];
}

/** A bounded evaluation cycle, no code writes or unreviewed legal conclusions. */
export async function runHermesEvidenceRebuild(empresaId:string):Promise<{ok:true;inspected:number}>{
 const db=await getSupabaseAdmin();
 const today=todayHermesBrazil();
 const {error}=await db.rpc('hermes_rebuild_company_evidence',{p_empresa:empresaId,p_day:today});
 if(error)throw Error('A autoavaliação Hermes não pôde ser concluída.');
 const items=await getHermesRebuildRuns(empresaId);
 return {ok:true,inspected:items.find(i=>i.day===today)?.findings_count||0};
}
/** Reuse the same lightweight provider gateway and Superagente policy. No case names/PII leave the DB. */
/** Reason category only; never persist raw provider errors, payloads or credentials. */
export function classifyHermesModelFailure(error:unknown):string{
 const reason=String(error instanceof Error?error.message:error||'').toLowerCase();
 if(/timeout|timed out|aborted|deadline|tempo esgotado/i.test(reason))return 'tempo_esgotado';
 if(/429|rate.limit|quota|limite de taxa|overloaded|capacity/i.test(reason))return 'limite_do_provedor';
 if(/401|403|invalid.*key|unauthoriz|credencial/i.test(reason))return 'autenticacao_provedor';
 if(/no provider|no engine|sem motor|sem.*chave|not configured/i.test(reason))return 'motor_indisponivel';
 if(/vazio|empty|sem resposta|não produziu/i.test(reason))return 'resposta_vazia';
 if(/fetch failed|econn|network|dns|socket/i.test(reason))return 'erro_de_rede';
 return 'falha_do_provedor';
}

/** Latest server-calculated portfolio diagnosis, tenant-scoped and cost-bounded. */
export async function getHermesPortfolioDiagnostics(empresaId:string):Promise<HermesPortfolioDiagnostics|null>{
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('hermes_portfolio_diagnostics')
   .select('payload,day,generated_at').eq('empresa_id',empresaId)
   .order('day',{ascending:false}).limit(1).maybeSingle();
 if(error)throw Error('O relatório detalhado Hermes ainda não pode ser consultado.');
 if(!data?.payload||typeof data.payload!=='object')return null;
 return normalizeHermesDiagnostics(data.payload as HermesPortfolioDiagnostics);
}

export async function getHermesOfficeEvents(empresaId:string):Promise<HermesOfficeEvent[]>{
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('hermes_office_events')
  .select('id,sector,kind,status,title,detail,processo_id,recorded_at')
  .eq('empresa_id',empresaId).order('recorded_at',{ascending:false}).limit(45);
 if(error)throw Error('O histórico auditável Hermes está temporariamente indisponível.');
 return (data||[]) as HermesOfficeEvent[];
}

export async function runHermesCompanyMeeting(empresaId:string,day:string){
 const db=await getSupabaseAdmin();
 const {data:claimed,error:claimError}=await db.rpc('hermes_claim_office_meeting',{p_empresa:empresaId,p_day:day});
 if(claimError)throw Error('Não foi possível reservar a reunião Hermes.');
 if(!claimed){
    const {data}=await db.from('hermes_office_daily')
       .select('meeting_status,meeting_attempts').eq('empresa_id',empresaId).eq('day',day).maybeSingle();
    return {ok:false,alreadyDone:true,
      error:data?.meeting_status==='ready'?'A reunião do dia já foi registrada.':
        Number(data?.meeting_attempts||0)>=3?'Limite de três tentativas de reunião atingido hoje.':
        'A reunião está em execução ou aguardando intervalo entre tentativas.'};
 }
 const m=claimed as Partial<HermesOfficeMetrics>;
 const evidence=await getHermesPortfolioDiagnostics(empresaId).catch(()=>null);
 const note=buildHermesVerifiedMeeting(m,day,evidence);
 const engine='auditoria-evidencias-v2';
 const state:'ready'='ready';
 const errorCode=null;
 const {error}=await db.from('hermes_office_daily').update({
   meeting_note:note,meeting_engine:engine,meeting_status:state,meeting_error_code:errorCode,
   updated_at:new Date().toISOString(),
 }).eq('empresa_id',empresaId).eq('day',day).eq('meeting_status','running');
 if(error)throw Error('A reunião não pôde ser registrada.');
 return {ok:true,alreadyDone:false,engine,state,errorCode};
}

/** Rows are visible only after authenticated supervisor check at the calling route. */
export async function getHermesCaseHealth(empresaId:string):Promise<HermesCaseHealth[]>{
 const db=await getSupabaseAdmin();
 const {data:reviews,error}=await db.from('hermes_return_reviews')
  .select('processo_id,due_on,priority_score,priority_label,djen_ok,datajud_ok,checked_at')
  .eq('empresa_id',empresaId).in('state',['ready','partial','unavailable'])
  .order('priority_score',{ascending:false}).order('checked_at',{ascending:false})
  .limit(14);
 if(error||!reviews?.length)return [];
 const ids=Array.from(new Set(reviews.map(r=>Number(r.processo_id)).filter(Number.isFinite)));
 const {data:cases, error:caseError}=await db.from('processos')
  .select('id,cliente,protocolo_ref,ultimo_retorno,proximo_retorno,status_interno,status,dados').eq('empresa_id',empresaId).in('id',ids);
 if(caseError)return [];
 const index=new Map((cases||[]).map(row=>[Number(row.id),row]));
 return reviews.flatMap(review=>{
  const found=index.get(Number(review.processo_id));
  if(!found)return [];
  if(classifyHermesReturnDate(found.ultimo_retorno,found.proximo_retorno,brazilToday())==='inconsistent')return [];
  if(String(found.proximo_retorno||'')!==String(review.due_on||''))return [];
  if(/ENCERRAD|ARQUIVAD|FINALIZAD|EXTINT/i.test(String(found.status_interno||'')+' '+String(found.status||'')+' '+String((found.dados as Record<string,unknown>|null)?.situacao||'')))return [];
  return [describeHermesCaseHealth({
   processId:Number(review.processo_id),
   client:String(found.cliente||'Cliente sem identificação').slice(0,90),
   cnj:String(found.protocolo_ref||'').slice(0,35),
   priorityScore:Number(review.priority_score)||0,
   priorityLabel:String(review.priority_label||'Sem classificação'),
   djenOk:review.djen_ok===true,datajudOk:review.datajud_ok===true,
   checkedAt:review.checked_at||null,dueOn:review.due_on||null,
  })];
 });
}

/** Latest actual official checks for processes without recent movement.
 * Read-only and tenant-scoped; never counts these as overdue client returns.
 */
export type HermesStalledSummary={
 processId:number;client:string;cnj:string;
 state:'scanning'|'confirmed_idle'|'no_dated_movement'|'partial'|'unavailable'|'recent_movement';
 checkedAt:string|null;lastMovementAt:string|null;daysWithoutMovement:number|null;
 djenOk:boolean;datajudOk:boolean;tribunalApiOk:boolean;tribunalApiSource:string|null;tribunalApiAttempted:boolean;sourceErrors:Record<string,string|null>;
};
export async function getHermesStalledSummaries(empresaId:string):Promise<HermesStalledSummary[]>{
 const db=await getSupabaseAdmin();
 const {data:reviews,error}=await db.from('hermes_stalled_reviews')
  .select('processo_id,state,checked_at,last_movement_at,days_without_movement,djen_ok,datajud_ok,tribunal_api_ok,tribunal_api_source,tribunal_api_checked_at,source_errors')
  .eq('empresa_id',empresaId).order('checked_at',{ascending:false}).limit(60);
 if(error)throw new Error('O painel de processos parados não pode ser carregado.');
 if(!reviews?.length)return [];
 const ids=reviews.map(r=>Number(r.processo_id)).filter(Number.isSafeInteger);
 const {data:processes,error:caseError}=await db.from('processos')
  .select('id,cliente,protocolo_ref,status,status_interno,dados')
  .eq('empresa_id',empresaId).in('id',ids);
 if(caseError)throw new Error('Falha ao ler os processos monitorados do escritório.');
 const byId=new Map((processes||[]).map(r=>[Number(r.id),r]));
 return reviews.flatMap(row=>{
  const process=byId.get(Number(row.processo_id));
  if(!process)return [];
  const status=String(process.status||'')+' '+String(process.status_interno||'')+' '+String((process.dados as Record<string,unknown>|null)?.situacao||'');
  if(/ENCERRAD|FINALIZAD|ARQUIVAD|EXTINT|BAIXA DEFINITIVA/i.test(status))return [];
  const errors=row.source_errors && typeof row.source_errors==='object'&&!Array.isArray(row.source_errors)
    ?row.source_errors as Record<string,string|null>:{};
  return [{
   processId:Number(row.processo_id),
   client:String(process.cliente||'Cliente sem nome').slice(0,90),
   cnj:String(process.protocolo_ref||'').slice(0,35),
   state:row.state as HermesStalledSummary['state'],
   checkedAt:row.checked_at||null,lastMovementAt:row.last_movement_at||null,
   daysWithoutMovement:typeof row.days_without_movement==='number'?row.days_without_movement:null,
   djenOk:row.djen_ok===true,datajudOk:row.datajud_ok===true,
   tribunalApiOk:row.tribunal_api_ok===true,tribunalApiSource:row.tribunal_api_source||null,
   tribunalApiAttempted:!!row.tribunal_api_checked_at,
   sourceErrors:errors,
  }];
 }).sort((a,b)=>{
  const rank=(s:HermesStalledSummary['state'])=>s==='confirmed_idle'?0:s==='partial'?1:s==='unavailable'?2:3;
  return rank(a.state)-rank(b.state)||Number(b.daysWithoutMovement||0)-Number(a.daysWithoutMovement||0);
 }).slice(0,30);
}


/** Evidência judicial do último scan, filtrada por empresa antes de expor à UI. */
export type HermesPortfolioCaseSummary={
 processId:number;client:string;cnj:string;
 state:'scanning'|'ready'|'partial'|'unavailable'|'skipped';
 checkedAt:string|null;datajudOk:boolean;djenOk:boolean;
 tribunalApiOk:boolean;tribunalApiSource:string|null;tribunalApiAttempted:boolean;
 findings:Record<string,any>;events:Array<{source:'DataJud'|'DJEN'|'TJPR PROJUDI';at:string;text:string;url:string|null}>;
 sourceErrors:Record<string,string|null>;
};
export async function getHermesPortfolioSummaries(
 empresaId:string,limit=35
):Promise<HermesPortfolioCaseSummary[]>{
 const db=await getSupabaseAdmin();
 const {data:scans,error}=await db.from('hermes_portfolio_scans')
  .select('processo_id,state,checked_at,datajud_ok,djen_ok,tribunal_api_ok,tribunal_api_source,tribunal_api_checked_at,findings,source_errors')
  .eq('empresa_id',empresaId).order('checked_at',{ascending:false,nullsFirst:false})
  .limit(Math.max(1,Math.min(limit,100)));
 if(error)throw new Error('Dossiês Hermes indisponíveis.');
 if(!scans?.length)return [];
 const ids=scans.map(s=>Number(s.processo_id)).filter(Number.isSafeInteger);
 const {data:rows,error:casesError}=await db.from('processos')
  .select('id,cliente,protocolo_ref').eq('empresa_id',empresaId).in('id',ids);
 if(casesError)throw new Error('Não foi possível consultar processos autorizados.');
 const byId=new Map((rows||[]).map(p=>[Number(p.id),p]));
 return scans.flatMap(s=>{
  const row=byId.get(Number(s.processo_id));
  if(!row)return [];
  return [{
   processId:Number(s.processo_id),client:String(row.cliente||'Cliente').slice(0,100),
   cnj:String(row.protocolo_ref||'').slice(0,35),
   state:s.state as HermesPortfolioCaseSummary['state'],
   checkedAt:s.checked_at||null,datajudOk:s.datajud_ok===true,djenOk:s.djen_ok===true,
   tribunalApiOk:s.tribunal_api_ok===true,tribunalApiSource:s.tribunal_api_source||null,
   tribunalApiAttempted:!!s.tribunal_api_checked_at,
   findings:(s.findings&&typeof s.findings==='object'&&!Array.isArray(s.findings))?s.findings:{},
   events:[],
   sourceErrors:(s.source_errors&&typeof s.source_errors==='object')?s.source_errors:{},
  }];
 });
}
