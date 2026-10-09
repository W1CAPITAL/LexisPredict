import {createHash} from 'node:crypto';
import {isCasoEncerrado} from '@/lib/status-encerrado';
import {buildClientMovementMessage,clientFirstName} from '@/lib/wa-client-notice';
import {matchingDjenNoticeEvidence,usableMovementDescription} from '@/lib/wa-source-evidence';
import {confirmedTerminalEvent} from '@/lib/judicial-terminal-evidence';

export type ReturnCase={
  id:number;empresa_id:string;cliente?:string|null;telefone?:string|null;protocolo_ref?:string|null;
  ultimo_retorno?:string|null;proximo_retorno?:string|null;
  datajud_ultimo_movimento?:string|null;datajud_ultimo_nome?:string|null;
  datajud_consultado_em?:string|null;
  djen_ultima_data?:string|null;djen_ultimo_resumo?:string|null;
  status?:string|null;status_interno?:string|null;
  dados?:Record<string,unknown>|null;
};
export type ReturnMode='due'|'requested'|'single';
export type PreparedReturn={
  processoId:number;empresaId:string;phone:string;cnj:string;name:string;
  source:'DataJud'|'DJEN';eventAt:string;eventHash:string;
  message:string;nextReturn:string;priorReturn:string;
};
export type ReturnDecision={ready:PreparedReturn|null;reason:'ok'|'not_due'|'closed'|'no_consent'|'blocked'|'phone'|'missing_return'|'no_new_movement'|'invalid_cnj'|'needs_source_review'};

export function brazilToday(now:Date=new Date()):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
const affirmative=(v:unknown)=>v===true||['sim','s','true','1','yes'].includes(String(v??'').trim().toLowerCase());
const denied=(v:unknown)=>v===false||['não','nao','n','false','0','no'].includes(String(v??'').trim().toLowerCase());
const blockedValue=(v:unknown)=>affirmative(v);
export function normalizePhone(value:unknown):string {
  let s=String(value??'').replace(/\D/g,'');
  if(s.length===10||s.length===11)s='55'+s;
  return /^55\d{10,11}$/.test(s)?s:'';
}
export function validReturnDay(raw:unknown):string|null {
  const s=String(raw||'').trim();
  const pt=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const day=pt?`${pt[3]}-${pt[2]}-${pt[1]}`:s.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const ms=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day?day:null;
}
function eventMillis(raw:unknown):number {
  const value=String(raw||'').trim();
  const day=validReturnDay(value);
  const ms=Date.parse(day && (value.length===10 || /^\d{2}\/\d{2}\/\d{4}$/.test(value))?day+'T12:00:00Z':value);
  return Number.isFinite(ms)&&ms>946684800000&&ms<=Date.now()+86400000?ms:0;
}
const text=(s:unknown)=>String(s||'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,650);
function advanceDay(day:string,days:number):string {
  const date=new Date(day+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+Math.min(30,Math.max(1,Math.trunc(days)||1)));
  return date.toISOString().slice(0,10);
}
export function isStatusRequest(input:string):boolean {
  const q=String(input||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(q.length<6||q.length>700)return false;
  if(/^(novidades?|atualizac(?:ao|oes)|movimentacao|andamento|processo|status|retorno|sentenca|decisao)[\s?!.]*$/.test(q))return true;
  return /(ultima|nova|novidade|recent[e]s?|houve|teve|saiu|qual|quero|preciso|tem|andamento|status|situacao|noticia|informacao|atualiza|movimenta|retorno|processo)/.test(q)
    && /(processo|acao|judicial|andamento|moviment|atualiza|retorno|situacao|status|decisao|sentenca|novidade)/.test(q)
    && !/(sair|stop|pare de|nao me envi|não me envi)/.test(q);
}
/** Only report a movement with a date AFTER the last contact day.
 * A date-only last-return record cannot distinguish two events on the same day.
 */
export function prepareDailyReturn(row:ReturnCase,opts:{
  mode:ReturnMode;today?:string;intervalDays?:number;consentAttested?:boolean;
}):ReturnDecision {
  const meta=row.dados||{};
  if(isCasoEncerrado(row))return {ready:null,reason:'closed'};
  const hasOptIn=['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'].some(k=>affirmative(meta[k]));
  if(['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout','bloquear_whatsapp','naoEnviarWhatsapp'].some(k=>blockedValue(meta[k])) || ['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'].some(k=>denied(meta[k])))
    return {ready:null,reason:'blocked'};
  if(!hasOptIn && opts.consentAttested!==true)return {ready:null,reason:'no_consent'};
  const phone=normalizePhone(row.telefone||meta.telefone||meta.TELEFONE);
  if(!phone)return {ready:null,reason:'phone'};
  const today=opts.today||brazilToday();
  const due=validReturnDay(row.proximo_retorno||meta.proximoRetorno||meta.proximo_retorno);
  if(opts.mode==='due' && (!due||due>today))return {ready:null,reason:'not_due'};
  const last=validReturnDay(row.ultimo_retorno||meta.ultimoRetorno||meta.ultimo_retorno);
  if(!last)return {ready:null,reason:'missing_return'};
  const candidates=[
    {source:'DataJud' as const,date:eventMillis(row.datajud_ultimo_movimento),text:text(row.datajud_ultimo_nome)},
    {source:'DJEN' as const,date:eventMillis(row.djen_ultima_data),text:text(row.djen_ultimo_resumo)},
  ].filter(c=>c.date>0&&c.text).sort((a,b)=>b.date-a.date);
  const latest=candidates[0];
  // The return is a local date. Compare event calendar days to avoid midnight
  // UTC movements being treated as new on the same Brazilian contact day.
  const latestDay=latest ? (latest.source==='DJEN' ? validReturnDay(row.djen_ultima_data)! : brazilToday(new Date(latest.date))) : '';
  const threshold=last;
  if(!latest||latestDay<=threshold)return {ready:null,reason:'no_new_movement'};
  const court=meta.tribunal_conferencia as {cnj?:string;ultimo_evento_em?:string}|undefined;
  if(court?.cnj?.replace(/\D/g,'')===String(row.protocolo_ref||meta.protocolo||'').replace(/\D/g,'') &&
      Date.parse(court.ultimo_evento_em||'')>latest.date)return {ready:null,reason:'needs_source_review'};
  let messageDetail=latest.text;
  if(latest.source==='DataJud') {
    const consulted=Date.parse(String(row.datajud_consultado_em||meta.datajud_consultado_em||''));
    if(!Number.isFinite(consulted)||consulted>Date.now()+60000||Date.now()-consulted>86400000)
      return {ready:null,reason:'needs_source_review'};
    if(/^(?:extin[cç][aã]o|extint[oa]|baixa|arquivamento|arquivad[oa]|tr[aâ]nsito|encerramento|encerrad[oa])\b/i.test(latest.text))
      return {ready:null,reason:'needs_source_review'};
  }
  if(latest.source==='DJEN') {
    const evidence=matchingDjenNoticeEvidence(meta.wa_djen_evidence,String(row.protocolo_ref||meta.protocolo||''),String(row.djen_ultima_data||''));
    // A cached keyword/AI summary is never the actual text of a publication.
    if(!evidence)return {ready:null,reason:'needs_source_review'};
    const consulted=Date.parse(evidence.checkedAt);
    if(!Number.isFinite(consulted)||consulted>Date.now()+60000||Date.now()-consulted>86400000)
      return {ready:null,reason:'needs_source_review'};
    latest.text=text(evidence.text);
    messageDetail=evidence.text;
    // Terminal acts require review of the current court status; do not announce
    // a closure while the portfolio still says the case is open.
    if(confirmedTerminalEvent(evidence.text))return {ready:null,reason:'needs_source_review'};
  }
  if(!usableMovementDescription(latest.text))return {ready:null,reason:'needs_source_review'};
  const digits=String(row.protocolo_ref||meta.protocolo||'').replace(/\D/g,'');
  const cnj=digits.length===20 ? `${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}` : '';
  if(!/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj))
    return {ready:null,reason:'invalid_cnj'};
  const name=clientFirstName(text(row.cliente||meta.cliente||'Cliente'));
  const when=latestDay.split('-').reverse().join('/');
  const message=buildClientMovementMessage({firstName:name,cnj,date:when,detail:messageDetail,source:latest.source});
  return {reason:'ok',ready:{
    processoId:Number(row.id),empresaId:row.empresa_id,phone,cnj,name,
    source:latest.source,eventAt:new Date(latest.date).toISOString(),
    eventHash:createHash('sha256').update([row.empresa_id,row.id,latest.source,latest.date,latest.text].join('|')).digest('hex'),
    message,priorReturn:last,nextReturn:advanceDay(today,opts.intervalDays||1),
  }};
}
