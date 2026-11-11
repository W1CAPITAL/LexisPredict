import {extrairAudienciasOficiais} from '@/lib/audiencias-monitor';
import type {HermesCourtEvent} from '@/lib/hermes-return-policy';

/** Indícios jurídicos rastreáveis, não substituem leitura da decisão e dos autos.
 * DataJud fornece metadados/movimentos; DJEN fornece publicações, não o inteiro teor de decisões.
 */
export type HermesFindingBasis='movimento_oficial'|'indicio_textual';
export type HermesFindingSource=HermesCourtEvent['source'];
export type HermesFinding<T extends string>={
 value:T; source:HermesFindingSource; date:string|null; excerpt:string;
 url:string|null; basis:HermesFindingBasis;
};
export type HermesJudicialFindings={
 verdict:(HermesFinding<'procedente'|'parcialmente_procedente'|'improcedente'>)|null;
 enforcement:HermesFinding<'cumprimento_iniciado'|'cumprimento_mencionado'>|null;
 attorneyFees:(HermesFinding<'honorarios_sucumbenciais_mencionados'>&{percentage:number|null})|null;
 legalAid:HermesFinding<'deferida'|'indeferida'>|null;
 courtCosts:(HermesFinding<'custas_mencionadas'>&{amount:string|null;paymentStatus:'nao_determinado'})|null;
 hearings:Array<{date:string;endDate:string|null;time:string|null;kind:string;meetingUrl:string|null;source:HermesFindingSource;excerpt:string;url:string|null}>;
 latestCourtMovement:string|null;
 latestDjenPublication:string|null;
 allCourtMovementsConfirmed:false;
};
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\(s\)/gi,'s').toLowerCase();
const textOnly=(value:unknown)=>String(value||'').replace(/<[^>]+>/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
const asDate=(raw:string):string|null=>{
 const day=String(raw||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const ms=Date.parse(day+'T12:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day?day:null;
};
function officialUrl(value:unknown):string|null{
 try{
  const url=new URL(String(value||''));
  return url.protocol==='https:' && (url.hostname.endsWith('.jus.br')||url.hostname==='jus.br')?url.href:null;
 }catch{return null;}
}
function videoLink(raw:string):string|null{
 if(!/audien|sess[aã]o|videoconfer|virtual/i.test(raw))return null;
 const urls=raw.match(/https:\/\/[^\s<>\\"'()]+/gi)||[];
 for(const candidate of urls){
  try{
   const url=new URL(candidate.replace(/[.,;]+$/,''));
   const host=url.hostname.toLowerCase();
   if(url.protocol==='https:'&&(
    host==='meet.google.com'||host==='teams.microsoft.com'||
    host==='zoom.us'||host.endsWith('.zoom.us')||
    host==='webex.com'||host.endsWith('.webex.com')||
    host==='jus.br'||host.endsWith('.jus.br')
   ))return url.href;
  }catch{/* Ignore invalid link. */}
 }
 return null;
}
function finding<T extends string>(value:T,event:HermesCourtEvent):HermesFinding<T>{
 return {
  value,source:event.source,date:asDate(event.at),
  excerpt:textOnly(event.text).slice(0,470),
  url:officialUrl(event.url),
  basis:event.source==='DataJud'?'movimento_oficial':'indicio_textual',
 };
}
function decision(raw:string):'procedente'|'parcialmente_procedente'|'improcedente'|null{
 const t=normalized(raw);
 // Não concluir sobre recurso, alegação ou tutela provisória com texto isolado.
 if(/recurso contra|recorre d[ae]|apela(?:cao)? contra|requer.{0,65}(?:seja )?julgad|pedido de tutela|liminar|sentenca de outro processo|sentenca que julgou/.test(t))return null;
 if(!/\b(julgo|julgad[oa]s?|sentenca.{0,35}(?:procedent|improcedent))\b/.test(t))return null;
 if(/parcialmente procedentes?|procedentes? em parte|julgad[oa]s? em parte/.test(t))return 'parcialmente_procedente';
 if(/(?:julgo|julgad[oa]s?).{0,36}improcedentes?/.test(t))return 'improcedente';
 if(/(?:julgo|julgad[oa]s?).{0,36}procedentes?/.test(t))return 'procedente';
 return null;
}
function latest(events:HermesCourtEvent[],source:HermesCourtEvent['source']):string|null{
 return events.filter(e=>e.source===source).map(e=>asDate(e.at)).filter((v):v is string=>!!v).sort().at(-1)||null;
}
export function buildHermesJudicialFindings(input:readonly HermesCourtEvent[]):HermesJudicialFindings{
 const events=[...input]
  .filter(e=>e&&['DataJud','DJEN'].includes(e.source)&&textOnly(e.text).length>=5)
  .sort((a,b)=>b.at.localeCompare(a.at))
  .slice(0,110);
 const result:HermesJudicialFindings={
  verdict:null,enforcement:null,attorneyFees:null,legalAid:null,courtCosts:null,hearings:[],
  latestCourtMovement:latest(events,'DataJud'),
  latestDjenPublication:latest(events,'DJEN'),
  allCourtMovementsConfirmed:false,
 };
 const hearingKeys=new Set<string>();
 for(const ev of events){
  const raw=textOnly(ev.text).slice(0,6500),t=normalized(raw);
  if(!result.verdict){
   const merito=decision(raw);
   if(merito)result.verdict=finding(merito,ev);
  }
  if(!result.enforcement && /cumprimento de sentenca|execucao de sentenca/.test(t)){
   const started=/determin.{0,38}(?:instaurac|inicio)|iniciad[oa]|instaurad[oa]|distribuid[oa]|cadastrad[oa]/.test(t)
      && !/pedido de instauracao|requer.{0,40}instaurac/.test(t);
   result.enforcement=finding(started?'cumprimento_iniciado':'cumprimento_mencionado',ev);
  }
  if(!result.attorneyFees&&/honorarios.{0,30}sucumbenc|sucumbencia.{0,25}honorarios|fixo.{0,26}honorarios/.test(t)){
   const m=/honor[aá]rios.{0,140}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i.exec(raw)
    || /(\d{1,2}(?:[.,]\d{1,2})?)\s*%.{0,100}honor[aá]rios/i.exec(raw);
   const percent=m?Number(m[1].replace(',','.')):null;
   result.attorneyFees={...finding('honorarios_sucumbenciais_mencionados',ev),
     percentage:percent!==null && percent>=0 && percent<=100?percent:null};
  }
  if(!result.legalAid){
   if(/(?:indefiro|indeferid[ao]|nego|negad[ao]).{0,65}(?:justica gratuita|gratuidade da justica|assistencia judiciaria)/.test(t))
     result.legalAid=finding('indeferida',ev);
   else if(/(?:defiro|deferid[ao]|concedo|concedid[ao]).{0,65}(?:justica gratuita|gratuidade da justica|assistencia judiciaria)/.test(t))
     result.legalAid=finding('deferida',ev);
  }
  if(!result.courtCosts&&/custas processuais|recolhimento das custas|pagamento de custas/.test(t)){
   const amount=/custas.{0,100}?R\$\s*([\d.,]+)/i.exec(raw);
   result.courtCosts={...finding('custas_mencionadas',ev),
    amount:amount?'R$ '+amount[1]:null,paymentStatus:'nao_determinado'};
  }
  for(const a of extrairAudienciasOficiais(raw)){
   if(a.situacao==='cancelada'||!a.data)continue;
   const key=a.tipo+'|'+a.data+'|'+(a.hora||'');
   if(hearingKeys.has(key))continue;
   hearingKeys.add(key);
   result.hearings.push({date:a.data,endDate:a.dataFim,time:a.hora,kind:a.tipo,
    meetingUrl:videoLink(raw),source:ev.source,excerpt:a.trecho.slice(0,450),url:officialUrl(ev.url)});
  }
  if(result.hearings.length>25)result.hearings=result.hearings.slice(0,25);
 }
 return result;
}
