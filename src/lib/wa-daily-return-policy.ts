import {createHash} from 'node:crypto';
import {isCasoEncerrado} from '@/lib/status-encerrado';

export type ReturnCase={
  id:number;empresa_id:string;cliente?:string|null;telefone?:string|null;protocolo_ref?:string|null;
  ultimo_retorno?:string|null;proximo_retorno?:string|null;
  datajud_ultimo_movimento?:string|null;datajud_ultimo_nome?:string|null;
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
export type ReturnDecision={ready:PreparedReturn|null;reason:'ok'|'not_due'|'closed'|'no_consent'|'blocked'|'phone'|'missing_return'|'no_new_movement'|'invalid_cnj'};

export function brazilToday(now:Date=new Date()):string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
const affirmative=(v:unknown)=>v===true||['sim','true','1','yes'].includes(String(v??'').toLowerCase());
const blockedValue=(v:unknown)=>affirmative(v);
export function normalizePhone(value:unknown):string {
  let s=String(value??'').replace(/\D/g,'');
  if(s.length===10||s.length===11)s='55'+s;
  return /^55\d{10,11}$/.test(s)?s:'';
}
function validDay(raw:unknown):string|null {
  const s=String(raw||'').trim();
  const pt=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const day=pt?`${pt[3]}-${pt[2]}-${pt[1]}`:s.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const ms=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day?day:null;
}
function eventMillis(raw:unknown):number {
  const value=String(raw||'').trim();
  const day=validDay(value);
  const ms=Date.parse(day && value.length===10?day+'T12:00:00Z':value);
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
  mode:ReturnMode;today?:string;intervalDays?:number;
}):ReturnDecision {
  const meta=row.dados||{};
  if(isCasoEncerrado(row))return {ready:null,reason:'closed'};
  const hasOptIn=['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'].some(k=>affirmative(meta[k]));
  if(['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout','bloquear_whatsapp'].some(k=>blockedValue(meta[k])))
    return {ready:null,reason:'blocked'};
  if(!hasOptIn)return {ready:null,reason:'no_consent'};
  const phone=normalizePhone(row.telefone||meta.telefone||meta.TELEFONE);
  if(!phone)return {ready:null,reason:'phone'};
  const today=opts.today||brazilToday();
  const due=validDay(row.proximo_retorno||meta.proximoRetorno||meta.proximo_retorno);
  if(opts.mode==='due' && (!due||due>today))return {ready:null,reason:'not_due'};
  const last=validDay(row.ultimo_retorno||meta.ultimoRetorno||meta.ultimo_retorno);
  if(!last)return {ready:null,reason:'missing_return'};
  const candidates=[
    {source:'DataJud' as const,date:eventMillis(row.datajud_ultimo_movimento),text:text(row.datajud_ultimo_nome)},
    {source:'DJEN' as const,date:eventMillis(row.djen_ultima_data),text:text(row.djen_ultimo_resumo)},
  ].filter(c=>c.date>0&&c.text).sort((a,b)=>b.date-a.date);
  const latest=candidates[0];
  const threshold=Date.parse(last+'T23:59:59.999Z');
  if(!latest||latest.date<=threshold)return {ready:null,reason:'no_new_movement'};
  const cnj=String(row.protocolo_ref||'').trim();
  if(!/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj))
    return {ready:null,reason:'invalid_cnj'};
  const name=text(row.cliente||meta.cliente||'Cliente').split(' ')[0]||'cliente';
  const when=new Date(latest.date).toLocaleDateString('pt-BR',{timeZone:'UTC'});
  const message=[
    `Olá, ${name}. Conforme solicitado/previsto para o acompanhamento do processo nº ${cnj}, identificamos uma movimentação desde o último retorno de ${last.split('-').reverse().join('/')}.`,
    `Último andamento registrado em ${when} — fonte ${latest.source}:\n“${latest.text}”`,
    'Este é o teor do registro disponível, não uma confirmação independente de procedência, pagamento ou encerramento. Para esclarecer seus efeitos, responda a esta conversa.',
    'Para não receber novos avisos, responda SAIR.',
  ].join('\n\n');
  return {reason:'ok',ready:{
    processoId:Number(row.id),empresaId:row.empresa_id,phone,cnj,name,
    source:latest.source,eventAt:new Date(latest.date).toISOString(),
    eventHash:createHash('sha256').update([row.empresa_id,row.id,latest.source,latest.date,latest.text].join('|')).digest('hex'),
    message,priorReturn:last,nextReturn:advanceDay(today,opts.intervalDays||1),
  }};
}
