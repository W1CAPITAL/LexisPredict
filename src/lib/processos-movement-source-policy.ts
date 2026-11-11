/** Estado real de cada fonte na aba "Movimentações" do Hermes.
 * A existência de HTTP 200, ou DJEN respondendo, não confirma DataJud.
 * O retorno oficial pode estar em cooldown por tribunal.
 */
export type ProcessDataJudStatus='confirmed'|'paused'|'timeout'|'rate_limited'|'not_found'|'mismatch'|'unavailable'|'not_queried';
export type ProcessDjenStatus='confirmed'|'unavailable';
export type ProcessSourcesStatus={datajud:ProcessDataJudStatus;djen:ProcessDjenStatus};

export function getProcessDataJudStatus(result:unknown,requestedCnj?:string):ProcessDataJudStatus{
 if(result===null)return 'not_queried';
 if(!result||typeof result!=='object')return 'unavailable';
 const r=result as Record<string,unknown>;
 if(r.error===false&&r.found===true){
  const cnj=String(r.numeroProcesso??'').replace(/\D/g,'');
  if(requestedCnj&&cnj!==requestedCnj.replace(/\D/g,''))return 'mismatch';
  return 'confirmed';
 }
 if(r.error===false&&r.found===false)return 'not_found';
 switch(r.errorCode){
  case 'cooldown':return 'paused';
  case 'timeout':case 'index_timeout':return 'timeout';
  case 'rate_limited':return 'rate_limited';
  case 'cnj_mismatch':return 'mismatch';
  case 'not_found':return 'not_found';
  default:return 'unavailable';
 }
}

export function formatProcessSourcesLabel(status:ProcessSourcesStatus):string{
 if(status.datajud==='confirmed'&&status.djen==='confirmed')return 'DataJud + DJEN confirmados';
 if(status.djen==='confirmed'){
  const label={
   paused:'em pausa',timeout:'sem resposta (timeout)',
   rate_limited:'limitado (HTTP 429)',not_found:'sem registro neste índice',
   mismatch:'com CNJ divergente',unavailable:'indisponível',
   not_queried:'não consultado nesta página',confirmed:'confirmado',
  }[status.datajud];
  return 'DJEN consultado · DataJud '+label;
 }
 if(status.datajud==='confirmed')return 'DataJud consultado · DJEN indisponível';
 return 'Fontes sem confirmação atual';
}

/** Mantém no navegador movimentos já confirmados em consulta anterior,
 * avisando que NÃO foram confirmados de novo. Nunca inventa movimentos.
 */
export function shouldPreservePreviousDataJud(previousCount:number,status:ProcessDataJudStatus):boolean{
 return Number.isFinite(previousCount)&&previousCount>0&&status!=='confirmed'&&status!=='not_queried';
}
