/**
 * Diagnóstico DataJud: uma consulta real, limitada e validada.
 * Não contabiliza HTTP 200 com timed_out/sem CNJ como "sucesso".
 * Reutiliza o mesmo resolvedor de alias, chave e payload do scanner Hermes.
 */
import {fetchDataJud,resolveDataJudAlias} from './datajud';

export async function probeDataJudHost(cnjDigits:string):Promise<{
 ok:boolean;latencyMs:number;error?:string;rateLimited?:boolean;
}>{
 const digits=String(cnjDigits||'').replace(/\D/g,'');
 if(digits.length!==20||!resolveDataJudAlias(digits)){
  return {ok:false,latencyMs:0,error:'CNJ inválido ou tribunal não identificado'};
 }
 const start=Date.now();
 // Probes não repetem 429/timeout em sequência nem abrem múltiplos sockets.
 const result=await fetchDataJud(digits,1,{
  fast:true,cloudBudget:true,forceRefresh:true,timeoutMs:15_000,
 });
 return {
  ok:result?.error===false&&result?.found===true,
  latencyMs:Number.isFinite(result?.latency)?Math.max(0,Math.round(result.latency)):Date.now()-start,
  ...(result?.error || result?.found!==true ? {error:String(result?.message||'Consulta não confirmada.').slice(0,180)} : {}),
  rateLimited:result?.httpStatus===429||result?.errorCode==='rate_limited',
 };
}
