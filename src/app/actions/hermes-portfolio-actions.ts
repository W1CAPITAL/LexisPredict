'use server';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {resolveOfficialCourtPortal} from '@/lib/hermes-official-fallbacks';

/** Exibe APENAS dossiês armazenados na empresa autenticada; não executa robô
 * nem consulta confidencial sem permissão, e não revela dados de outra empresa.
 */
export async function getHermesPortfolioByCnjAction(raw:string){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)return {ok:false,found:false,error:'Acesso não autorizado.'};
 const digits=String(raw||'').replace(/\D/g,'');
 if(digits.length!==20)return {ok:false,found:false,error:'CNJ inválido.'};
 const masked=`${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits[13]}.${digits.slice(14,16)}.${digits.slice(16)}`;
 const db=await getSupabaseAdmin();
 const {data:process,error:processError}=await db.from('processos')
  .select('id,cliente,protocolo_ref').eq('empresa_id',String(ctx.empresa_id))
  .in('protocolo_ref',[digits,masked]).limit(1).maybeSingle();
 if(processError)return {ok:false,found:false,error:'Consulta de cadastro indisponível.'};
 const portal=resolveOfficialCourtPortal(digits);
 if(!process)return {ok:true,found:false,portal:portal?.url||null};
 const {data:scan,error}=await db.from('hermes_portfolio_scans')
  .select('state,checked_at,datajud_ok,djen_ok,events,findings,source_errors')
  .eq('empresa_id',String(ctx.empresa_id)).eq('processo_id',process.id).maybeSingle();
 if(error)return {ok:false,found:false,error:'Histórico Hermes indisponível.'};
 if(!scan)return {ok:true,found:false,processId:process.id,portal:portal?.url||null};
 return {ok:true,found:true,processId:process.id,portal:portal?.url||null,
  state:scan.state,checkedAt:scan.checked_at,
  datajudOk:scan.datajud_ok===true,djenOk:scan.djen_ok===true,
  findings:scan.findings,events:Array.isArray(scan.events)?scan.events.slice(0,90):[],
  sourceErrors:scan.source_errors};
}
