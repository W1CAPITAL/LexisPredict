import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import type {CalendarEventInput} from './integracoes-suite';
import {buildCalendarEventUrl} from './integracoes-suite';

function keyBuffer(secret:string):Buffer{
 const key=Buffer.from(String(secret||''),'base64');
 if(key.length!==32)throw new Error('GOOGLE_CALENDAR_ENCRYPTION_KEY requer 32 bytes base64.');
 return key;
}
export function encryptCalendarToken(token:string,aad:string,base64Key:string):string{
 if(!token||!aad)throw new Error('Token ou vínculo de conta inválido.');
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',keyBuffer(base64Key),iv);
 cipher.setAAD(Buffer.from(aad,'utf8'));
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptCalendarToken(value:string,aad:string,base64Key:string):string {
 const parts=String(value||'').split('.');
 if(parts.length!==4||parts[0]!=='v1')throw new Error('Token inválido.');
 const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url');
 if(iv.length!==12||tag.length!==16)throw new Error('Token inválido.');
 const decipher=createDecipheriv('aes-256-gcm',keyBuffer(base64Key),iv);
 decipher.setAAD(Buffer.from(aad,'utf8'));
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8');
}
export function googleEventId(userId:string,input:CalendarEventInput):string {
 const payload=[userId,input.title.trim(),input.date,input.time||'',input.cnj||''].join('|');
 return 'a'+createHash('sha256').update(payload).digest('hex').slice(0,45);
}
export function googleCalendarEventPayload(userId:string,input:CalendarEventInput){
 // Reuse validated event range from the free Google Agenda builder.
 const url=new URL(buildCalendarEventUrl(input));
 const dates=String(url.searchParams.get('dates')||'').split('/');
 if(dates.length!==2)throw new Error('Intervalo inválido.');
 const timezone='America/Sao_Paulo';
 const timed=dates[0].length>8;
 const toDate=(v:string)=>v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8);
 const toDateTime=(v:string)=>toDate(v)+'T'+v.slice(9,11)+':'+v.slice(11,13)+':'+v.slice(13,15);
 const start=timed?{dateTime:toDateTime(dates[0]),timeZone:timezone}:{date:toDate(dates[0]),timeZone:timezone};
 const end=timed?{dateTime:toDateTime(dates[1]),timeZone:timezone}:{date:toDate(dates[1]),timeZone:timezone};
 const description=[
  input.cnj?'Processo: '+String(input.cnj).slice(0,35):'',
  input.notes?String(input.notes).slice(0,400):'',
  'Evento criado explicitamente pelo operador no LexisPredict. Não equivale a prazo judicial confirmado.'
 ].filter(Boolean).join('\n');
 return {id:googleEventId(userId,input),summary:input.title.trim(),description,start,end,
   extendedProperties:{private:{lexisOrigin:'operator-confirmed'}}};
}
export function googleCalendarConfigured(env:NodeJS.ProcessEnv=process.env):boolean{
 return Boolean(env.GOOGLE_CALENDAR_CLIENT_ID&&env.GOOGLE_CALENDAR_CLIENT_SECRET&&
  env.GOOGLE_CALENDAR_REDIRECT_URI&&env.GOOGLE_CALENDAR_ENCRYPTION_KEY);
}
