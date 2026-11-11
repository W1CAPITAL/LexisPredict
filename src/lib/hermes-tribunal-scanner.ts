import 'server-only';
import {getSupabaseAdmin} from '@/lib/server-db';
import {resolveOfficialTribunalAdapter,runOfficialTribunalConnector,
 type TribunalMovement, type TribunalAttemptStatus} from '@/lib/hermes-tribunal-adapters';

type Claim={empresa_id:string;processo_id:number;cnj:string};
type Recorded={
 empresa_id:string;processo_id:number;cnj:string;adapter:string;
 status:string;checked_at:string|null;next_allowed_at:string|null;
 movements:TribunalMovement[];movements_verified_at:string|null;
 source_url:string|null;note:string|null;
};
const NEXT_HOURS:Record<TribunalAttemptStatus,number>={
 verified:6,verified_empty:6,unsupported:72,restricted:24,
 rate_limited:4,timeout:3,unavailable:4,
 unexpected_response:24,cnj_mismatch:24,
};
const validDate=(text:unknown):boolean=>{
 const s=String(text||'');
 if(!/^\d{4}-\d\d-\d\d$/.test(s))return false;
 const dt=Date.parse(s+'T12:00:00Z');
 return Number.isFinite(dt)&&new Date(dt).toISOString().slice(0,10)===s;
};
export function normalizeTribunalMovements(v:unknown):TribunalMovement[]{
 if(!Array.isArray(v))return [];
 const seen=new Set<string>();
 const rows:TribunalMovement[]=[];
 for(const item of v.slice(0,150)){
  if(!item||typeof item!=='object')continue;
  const x=item as Partial<TribunalMovement>;
  const date=String(x.date||''),code=String(x.code||'');
  if(!validDate(date)||!/^\d{1,8}$/.test(code))continue;
  const key=date+'|'+code;
  if(seen.has(key))continue;
  seen.add(key);rows.push({date,code,name:'Movimento oficial TPU '+code});
 }
 return rows.slice(0,120);
}
export async function runHermesTribunalConnectorBatch(){
 const db=await getSupabaseAdmin();
 const {data:claims,error:claimError}=await db.rpc('hermes_claim_tribunal_connector');
 if(claimError)throw Error('Fila de conectores oficiais indisponível: '+claimError.code);
 const claim=(Array.isArray(claims)?claims[0]:null) as Claim|null;
 if(!claim)return {ok:true,processed:0,status:'empty'};
 const {data:original,error:readError}=await db.from('hermes_tribunal_public_movements')
  .select('empresa_id,processo_id,cnj,adapter,status,checked_at,next_allowed_at,movements,movements_verified_at,source_url,note')
  .eq('empresa_id',claim.empresa_id).eq('processo_id',claim.processo_id).maybeSingle();
 if(readError||!original)throw Error('Reserva do conector não pôde ser consultada.');
 const before=original as Recorded;
 const adapter=resolveOfficialTribunalAdapter(claim.cnj);
 if(!adapter)return {ok:false,processed:1,status:'unsupported'};
 const result=await runOfficialTribunalConnector(claim.cnj);
 const verified=result.status==='verified'||result.status==='verified_empty';
 const movements=verified?normalizeTribunalMovements(result.movements):normalizeTribunalMovements(before.movements);
 const now=new Date();
 const next=new Date(now.getTime()+NEXT_HOURS[result.status]*3600_000).toISOString();
 const {error:saveError}=await db.from('hermes_tribunal_public_movements').update({
  status:result.status,checked_at:result.checkedAt,next_allowed_at:next,
  movements, // falha jamais apaga evidência judicial confirmada antes
  movements_verified_at:verified?result.checkedAt:before.movements_verified_at,
  http_status:result.httpStatus,source_url:adapter.sourceUrl,
  note:result.message,
 }).eq('empresa_id',claim.empresa_id).eq('processo_id',claim.processo_id);
 if(saveError)throw Error('Evidência do conector não foi persistida: '+saveError.code);
 // Só rotular API do tribunal como confirmada quando houve resposta válida.
 // Não atribuir sucesso ao DataJud ou ao DJEN, nem modificar atendimento/retorno.
 if(verified){
  const {error:flagError}=await db.from('hermes_portfolio_scans').update({
   tribunal_api_ok:true,
   tribunal_api_source:adapter.label,
   tribunal_api_checked_at:result.checkedAt,
  }).eq('empresa_id',claim.empresa_id).eq('processo_id',claim.processo_id);
  if(flagError)console.warn('[Hermes Tribunal] Índice de fonte do tribunal não atualizado.');
 }
 return {
  ok:true,processed:1,status:result.status,adapter:adapter.code,
  movements:verified?movements.length:0,previousVerified:!verified&&movements.length>0,
 };
}
