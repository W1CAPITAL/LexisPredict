/** Integrações seguras sem custos de API e serialização mínima do Asaas.
 * Nenhuma função desta camada envia mensagens, cria cobrança ou altera calendário.
 */
export type CalendarEventInput={cnj?:string;title:string;date:string;time?:string;durationMinutes?:number;notes?:string};
function dateParts(value:string):{y:number;m:number;d:number;yyyyMMdd:string}{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Informe uma data válida (AAAA-MM-DD).');
 const [y,m,d]=value.split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d));
 if(y<2000||y>2200||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)throw new Error('Data inexistente.');
 return {y,m,d,yyyyMMdd:value.replace(/-/g,'')};
}
function timeParts(time:string):[number,number] {
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Hora inválida.');
 return [Number(time.slice(0,2)),Number(time.slice(3,5))];
}
function eventRange(input:CalendarEventInput){
 const a=dateParts(input.date);
 if(!input.title.trim()||input.title.trim().length>180)throw new Error('Título inválido.');
 if(input.time==null||input.time===''){
   const next=new Date(Date.UTC(a.y,a.m-1,a.d+1)).toISOString().slice(0,10).replace(/-/g,'');
   return {start:a.yyyyMMdd,end:next,allDay:true};
 }
 const [h,m]=timeParts(input.time);
 const dur=Math.min(240,Math.max(15,Math.trunc(input.durationMinutes||60)));
 const start=new Date(Date.UTC(a.y,a.m-1,a.d,h,m));
 const end=new Date(start.getTime()+dur*60_000);
 const format=(d:Date)=>d.toISOString().slice(0,19).replace(/[-:]/g,'');
 return {start:format(start),end:format(end),allDay:false};
}
export function buildCalendarEventUrl(input:CalendarEventInput):string {
 const range=eventRange(input);
 const query=new URLSearchParams({
   action:'TEMPLATE',
   text:input.title.trim(),
   dates:range.start+'/'+range.end,
   ctz:'America/Sao_Paulo',
   details:[input.notes?.trim(),input.cnj?'Processo CNJ '+input.cnj:'','Agendamento criado manualmente a partir do LexisPredict. Confirmar prazo na fonte judicial.'].filter(Boolean).join('\n').slice(0,1800)
 });
 return 'https://calendar.google.com/calendar/render?'+query;
}
function icsEscape(value:unknown):string {
 return String(value??'').slice(0,1500).replace(/\r\n|\r|\n/g,' ').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,');
}
export function buildIcsFile(input:CalendarEventInput):string {
 const range=eventRange(input);
 const id=String(input.cnj||'agenda').replace(/[^a-zA-Z0-9]/g,'').slice(0,60)||'agenda';
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const start=range.allDay?'DTSTART;VALUE=DATE:'+range.start:'DTSTART;TZID=America/Sao_Paulo:'+range.start;
 const end=range.allDay?'DTEND;VALUE=DATE:'+range.end:'DTEND;TZID=America/Sao_Paulo:'+range.end;
 const details=[input.notes?.trim(),input.cnj?'CNJ: '+input.cnj:'','Agendamento operacional; não substitui conferência no tribunal.'].filter(Boolean).join(' ');
 return [
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LexisPredict//Agenda Juridica//PT-BR',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
  'UID:'+id+'-'+range.start+'@lexispredict.app','DTSTAMP:'+stamp,
  start,end,'SUMMARY:'+icsEscape(input.title),
  'DESCRIPTION:'+icsEscape(details),'END:VEVENT','END:VCALENDAR',''
 ].join('\r\n');
}
export function normalizeLawyerSearch(value:string):string|null {
 const v=String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleUpperCase('pt-BR').slice(0,95);
 if(v.length<3||!/^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý\s.'-]+$/.test(v))return null;
 return v;
}
export type AsaasPaymentSummary={id:string;value:number;status:string;dueDate:string;billingType:string;invoiceUrl:string|null;externalReference:string|null};
export function mapAsaasPayment(raw:unknown):AsaasPaymentSummary|null {
 const v=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const id=String(v.id||'');
 const value=Number(v.value);
 const status=String(v.status||'').toUpperCase();
 const dueDate=String(v.dueDate||'');
 if(!/^pay_[A-Za-z0-9_-]{2,80}$/.test(id)||!Number.isFinite(value)||value<0||!datePartsSafe(dueDate))return null;
 const invoice=typeof v.invoiceUrl==='string'?v.invoiceUrl:'';
 let invoiceUrl:string|null=null;
 try {const url=new URL(invoice);if(url.protocol==='https:' && (url.hostname==='asaas.com'||url.hostname.endsWith('.asaas.com')))invoiceUrl=url.href;}catch{}
 return {id,value,status:status.slice(0,30),dueDate,billingType:String(v.billingType||'').slice(0,30),invoiceUrl,externalReference:typeof v.externalReference==='string'?v.externalReference.slice(0,90):null};
}
function datePartsSafe(value:string):boolean {try{dateParts(value);return true;}catch{return false;}}
