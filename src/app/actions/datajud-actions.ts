'use server';

import {getSupabaseAdmin,getUserContext} from '@/lib/server-db';
import {fetchDataJud} from '@/lib/datajud';
import {resolveDataJudAlias} from '@/lib/datajud-aliases';
import {isDataJudUseAuthorized} from '@/lib/datajud-policy';

function onlyDigits(value:string):string{return String(value||'').replace(/\D/g,'');}
function formatCnj(digits:string):string{
 return digits.length===20
  ?digits.slice(0,7)+'-'+digits.slice(7,9)+'.'+digits.slice(9,13)+'.'+digits.slice(13,14)+'.'+digits.slice(14,16)+'.'+digits.slice(16)
  :digits;
}

/** Health check server-side; only checks CNJs already present in the caller's tenant. */
export async function probeDataJudHealthAction(rawCnj:string):Promise<{
 success:boolean;found?:boolean;alias:string|null;latencyMs:number;errorCode?:string;message?:string;movementCount?:number;
}>{
 try{
  const context=await getUserContext();
  if(!context.empresa_id)return {success:false,alias:null,latencyMs:0,errorCode:'unauthorized',message:'Empresa não identificada.'};
  const cnj=onlyDigits(rawCnj);
  if(cnj.length!==20)return {success:false,alias:null,latencyMs:0,errorCode:'invalid_cnj',message:'CNJ inválido.'};
  const alias=resolveDataJudAlias(cnj);
  if(!alias)return {success:false,alias:null,latencyMs:0,errorCode:'unknown_jurisdiction',message:'Tribunal sem alias DataJud público conhecido.'};
  if(!isDataJudUseAuthorized())return {
   success:false,alias,latencyMs:0,errorCode:'terms_restricted',
   message:'Auditoria DataJud bloqueada: a API pública não está autorizada para este uso comercial.',
  };
  const db=await getSupabaseAdmin();
  const {data:owned,error:lookupError}=await db.from('processos').select('id')
   .eq('empresa_id',context.empresa_id).in('protocolo_ref',[formatCnj(cnj),cnj]).limit(1).maybeSingle();
  if(lookupError)return {success:false,alias,latencyMs:0,errorCode:'lookup_error',message:'Não foi possível validar o processo na carteira da empresa.'};
  if(!owned)return {success:false,alias,latencyMs:0,errorCode:'not_in_tenant',message:'O CNJ não foi localizado na carteira desta empresa.'};
  const started=Date.now();
  const result=await fetchDataJud(cnj,1,{fast:true,cloudBudget:true,forceRefresh:true,timeoutMs:8000});
  const latencyMs=Number(result?.latency)||Date.now()-started;
  const success=result?.error===false;
  return {
   success,found:result?.found===true,alias,latencyMs,errorCode:result?.errorCode||undefined,
   message:result?.message||undefined,movementCount:Array.isArray(result?.movimentos)?result.movimentos.length:0,
  };
 }catch(error:any){
  return {success:false,alias:null,latencyMs:0,errorCode:'internal_error',message:error?.message||'Falha na auditoria DataJud.'};
 }
}
