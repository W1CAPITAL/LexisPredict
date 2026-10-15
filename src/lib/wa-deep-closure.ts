import 'server-only';
import {createHash} from 'node:crypto';
import {fetchDataJud} from '@/lib/datajud';
import {fetchDjenComunicacoes} from '@/lib/djen';
import {normalizeMovimentosList,parseTimelineDate} from '@/lib/timeline-normalize';
import {confirmedTerminalEvent} from '@/lib/judicial-terminal-evidence';

type Input={
 cnj:string;
 hasEnforcement:boolean;
 hasPendingEnforcement:boolean;
 details?:Record<string,any>|null;
};

export type DeepClosureFinding={
 decision:'confirmed_closed'|'active_enforcement'|'not_confirmed'|'source_unavailable';
 reason:string;
 checkedAt:string;
 evidence:{
  datajudOk:boolean; djenOk:boolean; movementCount:number; publicationCount:number;
  terminalEvent:string|null; terminalDate:string|null; latestMovement:string|null;
  latestPublication:string|null; afterTerminal:number; sourceHash:string|null;
 };
};

/** Search the actual ordered official chronology; NEVER trust the historical
 * sticky boolean datajud_encerrado_tribunal or a stale summary as proof.
 */
export async function deeplyVerifyClosure(input:Input):Promise<DeepClosureFinding>{
 const checkedAt=new Date().toISOString();
 const digits=input.cnj.replace(/\D/g,'');
 const cutoff=Date.now()-365*86400_000;
 if(digits.length!==20)throw Error('Invalid CNJ for court closure check');
 const since=new Date(Date.now()-4*365*86400_000).toISOString().slice(0,10);
 const [datajudResult,djenResult]=await Promise.allSettled([
  fetchDataJud(digits,2,{fast:true,cloudBudget:true}),
  fetchDjenComunicacoes(digits,{dataInicio:since,cloudBudget:true}),
 ]);
 const dj=datajudResult.status==='fulfilled'?datajudResult.value:null;
 const djen=djenResult.status==='fulfilled'?djenResult.value:null;
 // DataJud's "not found" is a valid HTTP response, not evidence of a case's status.
 const djOk=!!dj&&!dj.error&&Array.isArray(dj.movimentos)&&
   (dj.movimentos.length>0 || dj.message!=='Não localizado no DataJud.');
 const djenOk=djen?.success===true;
 const movements=djOk?normalizeMovimentosList(dj.movimentos):[];
 const pubs=djenOk&&Array.isArray(djen.items)?djen.items:[];
 const pubDates=pubs.map((x:any)=>Date.parse(String(
  x.dataDisponibilizacao||x.data_disponibilizacao||x.data||''
 ))).filter((t:number)=>Number.isFinite(t)&&t>0);
 const latestPub=pubDates.length?Math.max(...pubDates):null;
 const latestMov=movements.map(m=>parseTimelineDate(m.dataHora).getTime())
  .filter(t=>Number.isFinite(t)&&t>0);
 const maxMov=latestMov.length?Math.max(...latestMov):null;
 const relevant=movements.map(m=>{
  const time=parseTimelineDate(m.dataHora).getTime();
  // The canonical title supplied by the court must be a definitive event,
  // not merely a request/quotation in a document's lengthy narrative.
  const title=String(m.nome||'').trim();
  return {time,title,terminal:confirmedTerminalEvent(title)};
 }).filter(m=>Number.isFinite(m.time)&&m.time>0)
   .sort((a,b)=>b.time-a.time);
 const terminal=relevant.find(m=>m.terminal==='baixa'||m.terminal==='arquivamento');
 const afterTerminal=terminal?relevant.filter(m=>m.time>terminal.time+3600000).length:0;
 const normalizedEvents=relevant.slice(0,150).map(m=>[m.time,m.title.slice(0,160)]);
 const hash=djOk?createHash('sha256').update(JSON.stringify(normalizedEvents)).digest('hex'):null;
 const evidence={
  datajudOk:djOk,djenOk,movementCount:movements.length,
  publicationCount:pubs.length,terminalEvent:terminal?.title||null,
  terminalDate:terminal?new Date(terminal.time).toISOString():null,
  latestMovement:maxMov?new Date(maxMov).toISOString():null,
  latestPublication:latestPub?new Date(latestPub).toISOString():null,
  afterTerminal,sourceHash:hash,
 };
 const result=(decision:DeepClosureFinding['decision'],reason:string):DeepClosureFinding=>
   ({decision,reason,checkedAt,evidence});
 if(!djOk||!djenOk)
  return result('source_unavailable','É preciso refazer consulta oficial: DataJud ou DJEN não trouxe resposta completa.');
 if(input.hasEnforcement||input.hasPendingEnforcement||
    input.details?.cumprimento_ativo===true||
    /cumprimento ativo|execucao ativa/i.test(String(input.details?.status_executivo||'')))
  return result('active_enforcement','Existe indicação de fase de cumprimento ou execução que exige acompanhamento próprio.');
 if(!terminal)
  return result('not_confirmed','Histórico oficial consultado sem baixa ou arquivamento definitivo inequívoco.');
 if(terminal.time>=cutoff)
  return result('not_confirmed','Evento de baixa/arquivamento não atingiu um ano; manter acompanhamento.');
 if(afterTerminal>0)
  return result('not_confirmed','Há movimentações posteriores ao evento de baixa/arquivamento; situação pode ter mudado.');
 if(latestPub!==null&&latestPub>terminal.time+3600000)
  return result('not_confirmed','Há publicação DJEN posterior à baixa/arquivamento; não presumir encerramento.');
 if(!maxMov||maxMov>terminal.time+3600000)
  return result('not_confirmed','Cronologia do DataJud ainda não permite confirmar encerramento final.');
 return result('confirmed_closed','Baixa/arquivamento definitivo anterior a um ano, com fontes oficiais válidas e sem evento posterior conhecido.');
}
