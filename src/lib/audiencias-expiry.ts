/** Expiração conservadora por data local do próprio tribunal. */
export type AudienciaExpiryInput={
 data?:string|null;data_evento?:string|null;
 dataFim?:string|null;data_fim?:string|null;
 horaFim?:string|null;hora_fim?:string|null;
 fuso?:string|null;
};
const TZ_BY_UF:Record<string,string>={
 SP:'America/Sao_Paulo',BRASILIA:'America/Sao_Paulo',DF:'America/Sao_Paulo',
 MT:'America/Cuiaba',MS:'America/Campo_Grande',AM:'America/Manaus',
 AC:'America/Rio_Branco',RO:'America/Porto_Velho',RR:'America/Boa_Vista',
 PA:'America/Belem',AP:'America/Belem',TO:'America/Araguaina',
 MA:'America/Fortaleza',PI:'America/Fortaleza',CE:'America/Fortaleza',
 RN:'America/Fortaleza',PB:'America/Fortaleza',PE:'America/Recife',
 AL:'America/Maceio',SE:'America/Maceio',BA:'America/Bahia',
 MG:'America/Sao_Paulo',ES:'America/Sao_Paulo',RJ:'America/Sao_Paulo',
 PR:'America/Sao_Paulo',SC:'America/Sao_Paulo',RS:'America/Sao_Paulo',
 GO:'America/Sao_Paulo'
};
function timezoneFor(event:AudienciaExpiryInput):string{
 const raw=String(event.fuso||'').trim().toUpperCase();
 return TZ_BY_UF[raw]||'America/Sao_Paulo';
}
function localDay(now:Date,timeZone:string):string{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return value('year')+'-'+value('month')+'-'+value('day');
}
function validDay(value:unknown):string|null{
 const raw=String(value??'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
 const date=new Date(raw+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===raw?raw:null;
}
/**
 * Só expira quando o último dia oficial do evento já passou no fuso do tribunal.
 * Não usa hora_fim para exclusão: extratores antigos podem ter associado a hora
 * de início ao fim. Eventos do próprio dia ficam preservados até o dia seguinte.
 */
export function isAudienciaExpirada(event:AudienciaExpiryInput,now=new Date()):boolean{
 const endDay=validDay(event.dataFim)??validDay(event.data_fim)??validDay(event.data)??validDay(event.data_evento);
 if(!endDay)return false;
 return endDay<localDay(now,timezoneFor(event));
}
export function filtrarAudienciasVigentes<T extends AudienciaExpiryInput>(events:readonly T[],now=new Date()):T[]{
 return events.filter(event=>!isAudienciaExpirada(event,now));
}
