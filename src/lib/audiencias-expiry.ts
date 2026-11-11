/** Expiração conservadora de eventos judiciais pelo relógio de Brasília. */
export type AudienciaExpiryInput={
 data?:string|null;data_evento?:string|null;
 dataFim?:string|null;data_fim?:string|null;
 horaFim?:string|null;hora_fim?:string|null;
};
const TZ='America/Sao_Paulo';
function localDay(now:Date):string{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return value('year')+'-'+value('month')+'-'+value('day');
}
function localClock(now:Date):string{
 return new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
}
function validDay(value:unknown):string|null{
 const raw=String(value??'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
 const date=new Date(raw+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw?raw:null;
}
function validClock(value:unknown):string|null{
 const match=/^(\d{1,2}):([0-5]\d)$/.exec(String(value??'').trim());
 if(!match)return null;
 const hour=Number(match[1]);
 if(hour>23)return null;
 return String(hour).padStart(2,'0')+':'+match[2];
}
/**
 * Expira quando a data final (ou, sem intervalo, a data do evento) já passou.
 * No próprio dia, só apaga quando existe hora final confirmada e ela passou.
 * Uma sessão iniciada ontem e terminando amanhã permanece na agenda.
 */
export function isAudienciaExpirada(event:AudienciaExpiryInput,now=new Date()):boolean{
 const endDay=validDay(event.dataFim)??validDay(event.data_fim)??validDay(event.data)??validDay(event.data_evento);
 if(!endDay)return false;
 const today=localDay(now);
 if(endDay<today)return true;
 if(endDay>today)return false;
 const endTime=validClock(event.horaFim??event.hora_fim);
 return Boolean(endTime&&endTime<=localClock(now));
}
export function filtrarAudienciasVigentes<T extends AudienciaExpiryInput>(events:readonly T[],now=new Date()):T[]{
 return events.filter(event=>!isAudienciaExpirada(event,now));
}
