import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import { freeComplete } from '@/lib/ai/free-gateway';
import { superAgentInstructions } from '@/lib/ai/lexis-superagent';
import type {HermesOfficeEvent} from '@/lib/hermes-agent-route';
import {
  buildHermesOfficeIntelligence,makeHermesMeetingPrompt,
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
 return data as HermesOfficeDailyRow|null;
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
 const fallback=buildHermesOfficeIntelligence(m,day).meeting.map(x=>x.speaker+': '+x.text).join('\n');
 let note=fallback,engine='regras-verificadas',state:'ready'|'unavailable'='ready',errorCode:string|null=null;
 try{
   const reply=await freeComplete({
     user:makeHermesMeetingPrompt(m,day),
     system:superAgentInstructions('relatorio')+
       '\nREUNIÃO HERMES: Produza quatro falas curtas, uma por linha, identificadas EXATAMENTE como Gerência:, Supervisão:, Processos:, Comunicação:. A gerência abre com uma prioridade; a supervisão questiona a qualidade das fontes, processos responde com evidências agregadas, e comunicação define um próximo passo revisável. Use somente os números informados. Não invente descobertas, pessoas substituídas nem chance judicial. Não mostre dados pessoais, não envie mensagens e não execute ações.',
     preferred:'groq',max_tokens:320,timeoutMs:40000
   });
   const clean=sanitizeHermesMeetingOutput(reply.text);
   if(clean.length<35)throw Error('Modelo não produziu síntese utilizável');
   note=clean;engine=String(reply.engine||'motor-superagente').slice(0,100);
 }catch(error){
   state='unavailable';
   errorCode=classifyHermesModelFailure(error);
   // The bounded rule-based agenda is preserved, but the model did not participate.
   console.warn('[Hermes] reunião IA não concluída:',errorCode);
 }
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
  .eq('empresa_id',empresaId).in('state',['ready','unavailable'])
  .order('priority_score',{ascending:false}).order('checked_at',{ascending:false})
  .limit(14);
 if(error||!reviews?.length)return [];
 const ids=Array.from(new Set(reviews.map(r=>Number(r.processo_id)).filter(Number.isFinite)));
 const {data:cases, error:caseError}=await db.from('processos')
  .select('id,cliente,protocolo_ref').eq('empresa_id',empresaId).in('id',ids);
 if(caseError)return [];
 const index=new Map((cases||[]).map(row=>[Number(row.id),row]));
 return reviews.flatMap(review=>{
  const found=index.get(Number(review.processo_id));
  if(!found)return [];
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
