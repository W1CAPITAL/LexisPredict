// Pure helpers shared by the hosted Deno worker and Node regression tests.
// Judicial evidence must be tied to an exact CNJ; absence from an index is not
// evidence of absence from the court docket.
const COURTS_8=['tjac','tjal','tjap','tjam','tjba','tjdft','tjes','tjgo','tjma','tjmt','tjms','tjmg','tjpa','tjpb','tjpr','tjpe','tjpi','tjrj','tjrn','tjrs','tjro','tjrr','tjsc','tjse','tjsp','tjto'];
const TJS={'01':'tjac','02':'tjal','03':'tjap','04':'tjam','05':'tjba','06':'tjce','07':'tjdft','08':'tjes','09':'tjgo','10':'tjma','11':'tjmt','12':'tjms','13':'tjmg','14':'tjpa','15':'tjpb','16':'tjpr','17':'tjpe','18':'tjpi','19':'tjrj','20':'tjrn','21':'tjrs','22':'tjro','23':'tjrr','24':'tjsc','25':'tjse','26':'tjsp','27':'tjto'};
export const cleanCnj = input => {
  const digits=String(input??'').replace(/\D/g,'');
  return digits.length===20?digits:null;
};
export function courtAlias(input) {
  const d=cleanCnj(input);if(!d)return null;
  const ramo=d[13],court=d.slice(14,16);
  if(ramo==='8')return TJS[court]||null;
  if(ramo==='4')return Number(court)>=1&&Number(court)<=6?'trf'+Number(court):null;
  if(ramo==='5')return Number(court)>=1&&Number(court)<=24?'trt'+Number(court):null;
  if(ramo==='3')return court==='00'?'stj':null;
  if(ramo==='6')return court==='00'?'tse':null;
  if(ramo==='7')return court==='00'?'stm':null;
  return null;
}
const text=(value,n=360)=>String(value??'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const day=value=>{
  const raw=String(value??'').trim();
  const d=/^20\d\d-\d\d-\d\d/.exec(raw);
  if(d)return d[0];
  const compact=/^(20\d\d)(\d\d)(\d\d)/.exec(raw);
  return compact?compact[1]+'-'+compact[2]+'-'+compact[3]:null;
};
const newest=events=>events.map(e=>e.date).filter(Boolean).sort().at(-1)||null;
export function normalizeDataJud(payload,cnj) {
  if(!Array.isArray(payload?.hits?.hits)||payload?.timed_out===true||Number(payload?._shards?.failed||0)>0)throw Error('invalid_datajud_payload');
  const selected=payload.hits.hits.map(x=>x?._source).find(x=>cleanCnj(x?.numeroProcesso)===cnj&&Number(x?.nivelSigilo||0)===0);
  if(!selected)return {found:false,events:[],latestDay:null};
  const events=(Array.isArray(selected.movimentos)?selected.movimentos:[]).slice(-700).map((m,i)=>({
    id:'datajud-'+String(m?.codigo||m?.movimentoNacional?.codigo||'evt')+'-'+String(m?.dataHora||m?.data||i),
    source:'DataJud',
    date:day(m?.dataHora||m?.data||m?.dataMovimento),
    title:text(m?.nome||m?.movimentoNacional?.nome||m?.descricao||'Movimentação judicial',220),
    description:text(m?.descricao||'',420),
    at:day(m?.dataHora||m?.data||m?.dataMovimento),
    text:text(m?.nome||m?.movimentoNacional?.nome||m?.descricao||'Movimentação judicial',350),
    url:null,
  })).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,40);
  return {found:true,events,latestDay:newest(events)};
}
export function normalizeDjen(payload,cnj) {
  const rows=Array.isArray(payload)?payload:
    Array.isArray(payload?.items)?payload.items:
    Array.isArray(payload?.content)?payload.content:
    Array.isArray(payload?.comunicacoes)?payload.comunicacoes:
    Array.isArray(payload?.resultado)?payload.resultado:null;
  if(!rows)throw Error('invalid_djen_payload');
  const events=rows.filter(row=>{
    const related=cleanCnj(row?.numeroProcesso||row?.numero_processo||cnj);
    return related===cnj;
  }).slice(0,45).map((row,i)=>({
    id:'djen-'+String(row?.id||row?.hash||row?.numeroComunicacao||i)+'-'+String(row?.dataDisponibilizacao||row?.data_disponibilizacao||i),
    source:'DJEN',
    date:day(row?.dataDisponibilizacao||row?.data_disponibilizacao||row?.dataPublicacao),
    title:text(row?.tipoComunicacao||row?.tipo||'Publicação judicial',180),
    description:text(row?.texto||row?.conteudo||row?.teor||'',480),
    at:day(row?.dataDisponibilizacao||row?.data_disponibilizacao||row?.dataPublicacao),
    text:text(row?.texto||row?.conteudo||row?.teor||'',480),
    url:null,
  })).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return {events,latestDay:newest(events)};
}
export function mergeEvents(saved=[],datajud=[],djen=[],limit=100){
  const found=new Map();
  for(const e of [...datajud,...djen,...saved]){
    if(!e||typeof e!=='object'||!['DataJud','DJEN'].includes(e.source))continue;
    // Legacy Hermes events use {source,at,text,url}, without id.
    // Keep those events exactly; never drop court evidence during migration.
    const key=String(e.id||[e.source,e.date||e.at||'',e.title||e.text||''].join('|'));
    if(!found.has(key))found.set(key,e);
  }
  return [...found.values()].sort((a,b)=>String(b.date||b.at||'').localeCompare(String(a.date||a.at||''))).slice(0,limit);
}
