/** Fila única de retorno administrativo da empresa — nunca confundir com prazo judicial. */
import type {LegalCase} from '@/lib/case-logic';
import {scoreCasePriority} from '@/lib/case-priority';
import {isCasoEncerrado} from '@/lib/status-encerrado';

export type CompanyReturnQueueItem<T extends LegalCase=LegalCase>={
 process:T;
 dueOn:string;
 lastContact:string;
 daysLate:number;
 kind:'overdue'|'today';
 priorityScore:number;
 priorityLabel:string;
};

function validDay(raw:unknown):string|null{
 const value=String(raw??'').trim();
 const pt=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
 const date=pt?`${pt[3]}-${pt[2]}-${pt[1]}`:value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const ms=Date.parse(date+'T12:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date?date:null;
}
function dayDifference(a:string,b:string):number{
 return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
}
export function listCompanyDueReturns<T extends LegalCase>(
 processes:readonly T[],todayRaw:string
):CompanyReturnQueueItem<T>[]{
 const today=validDay(todayRaw);
 if(!today)return [];
 const seen=new Set<string>();
 const result:CompanyReturnQueueItem<T>[]=[];
 for(const process of processes){
  if(!process||isCasoEncerrado(process))continue;
  // As colunas do banco chegam por ultimoRetorno / proximoPrazo no adaptador de carteira.
  const last=validDay(process.ultimoRetorno);
  const next=validDay(process.proximoPrazo);
  // A data do próximo retorno é o critério operacional. Não impor intervalo
  // mínimo arbitrário de 20 dias: isso ocultava retornos válidos da empresa.
  if(!next||next>today||(last&&dayDifference(next,last)<0))continue;
  const id=String(process.db_id||process.id||process.protocolo||'').trim();
  if(!id||seen.has(id))continue;
  seen.add(id);
  const priority=scoreCasePriority(process);
  result.push({
   process,lastContact:last||'',dueOn:next,daysLate:Math.max(0,dayDifference(today,next)),
   kind:next===today?'today':'overdue',
   priorityScore:priority.score,priorityLabel:priority.label
  });
 }
 return result.sort((a,b)=>
  b.priorityScore-a.priorityScore ||
  b.daysLate-a.daysLate ||
  a.dueOn.localeCompare(b.dueOn) ||
  String(a.process.cliente||'').localeCompare(String(b.process.cliente||''),'pt-BR')
 );
}
