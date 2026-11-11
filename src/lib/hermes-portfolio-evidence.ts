import type {HermesCourtEvent,HermesCourtSnapshot} from '@/lib/hermes-return-policy';
/** Dossiê judicial cumulativo: falha parcial não pode substituir evidência já confirmada. */
const day=(raw:unknown):string|null=>{
 const x=String(raw||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;
 const t=Date.parse(x+'T12:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===x?x:null;
};
const plain=(text:unknown,max=2400)=>String(text||'').replace(/<[^>]+>/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const official=(value:unknown):string|null=>{
 try{const u=new URL(String(value||''));return u.protocol==='https:'&&(u.hostname==='jus.br'||u.hostname.endsWith('.jus.br'))?u.href:null;}catch{return null;}
};
function normalizeEvent(raw:HermesCourtEvent):HermesCourtEvent|null{
 if(!raw||!['DataJud','DJEN','TJPR PROJUDI'].includes(raw.source))return null;
 const at=day(raw.at),text=plain(raw.text);
 if(!at||!text)return null;
 return {source:raw.source,at,text,url:official(raw.url)};
}
const key=(event:HermesCourtEvent)=>[event.source,event.at,event.text.toLowerCase()].join('|');
const newer=(a:HermesCourtEvent,b:HermesCourtEvent)=>b.at.localeCompare(a.at)||a.source.localeCompare(b.source);
/** Mantém dados de AMBAS as fontes, evita duplicação e limita o tamanho persistido.
 * Nunca confunde publicação DJEN com movimentação processual DataJud.
 */
export function mergeHermesCourtHistory(
 previous:readonly HermesCourtEvent[]|null|undefined,
 fresh:readonly HermesCourtEvent[]|null|undefined,
 limit=120
):HermesCourtEvent[]{
 const map=new Map<string,HermesCourtEvent>();
 for(const raw of [...(previous||[]),...(fresh||[])]){
  const value=normalizeEvent(raw);
  if(!value)continue;
  const id=key(value),old=map.get(id);
  if(!old||(!old.url&&value.url))map.set(id,value);
 }
 const ordered=[...map.values()].sort(newer);
 const cap=Math.max(2,Math.min(250,Math.trunc(limit)));
 const sources:HermesCourtEvent['source'][]=['DataJud','DJEN','TJPR PROJUDI'];
 const minimumEach=Math.floor(cap/sources.length);
 const preferred=sources.flatMap(source=>ordered.filter(v=>v.source===source).slice(0,minimumEach));
 const chosen=new Map<string,HermesCourtEvent>();
 for(const e of preferred)chosen.set(key(e),e);
 for(const e of ordered){if(chosen.size>=cap)break;chosen.set(key(e),e);}
 return [...chosen.values()].sort(newer).slice(0,cap);
}
export type HermesProcessPatch={
 datajud_last_ok?:boolean;datajud_consultado_em?:string;
 datajud_ultimo_movimento?:string;datajud_ultimo_nome?:string;ultima_movimentacao?:string;
 djen_last_ok?:boolean;djen_consultado_em?:string;
 djen_ultima_data?:string;djen_ultimo_resumo?:string;djen_ultimo_link?:string;
};
/** Atualiza somente campos de fonte e última movimentação quando o DataJud de fato responde.
 * Nunca altera status, mérito administrativo, retornos ou datas de audiência.
 */
export function buildHermesVerifiedProcessPatch(input:{
 snapshot:HermesCourtSnapshot;checkedAt:string;
 lastDataJudMovement:string|null;lastMovement:string|null;lastDjenPublication:string|null;
}):HermesProcessPatch{
 const patch:HermesProcessPatch={};
 if(input.snapshot.datajudOk){
  patch.datajud_last_ok=true;
  patch.datajud_consultado_em=input.checkedAt;
  const last=(input.snapshot.events||[])
   .filter(e=>e.source==='DataJud'&&day(e.at)&&plain(e.text))
   .sort(newer)[0];
  if(last){
   const at=day(last.at)!;
   if(!day(input.lastDataJudMovement)||at>day(input.lastDataJudMovement)!){
    patch.datajud_ultimo_movimento=at+'T12:00:00Z';
    patch.datajud_ultimo_nome=plain(last.text,500);
   }
  }
 }
 const latestOfficialMovement=(input.snapshot.events||[])
  .filter(e=>(e.source==='DataJud'||e.source==='TJPR PROJUDI')&&day(e.at)&&plain(e.text))
  .sort(newer)[0];
 if(latestOfficialMovement){
  const at=day(latestOfficialMovement.at)!;
  if(!day(input.lastMovement)||at>day(input.lastMovement)!)patch.ultima_movimentacao=at;
 }
 if(input.snapshot.djenOk){
  patch.djen_last_ok=true;
  patch.djen_consultado_em=input.checkedAt;
  const last=(input.snapshot.events||[])
   .filter(e=>e.source==='DJEN'&&day(e.at)&&plain(e.text))
   .sort(newer)[0];
  if(last){
   const at=day(last.at)!;
   if(!day(input.lastDjenPublication)||at>day(input.lastDjenPublication)!){
    patch.djen_ultima_data=at;
    patch.djen_ultimo_resumo=plain(last.text,600);
    if(official(last.url))patch.djen_ultimo_link=official(last.url)!;
   }
  }
 }
 return patch;
}
