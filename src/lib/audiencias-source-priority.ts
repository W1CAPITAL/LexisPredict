/** Uma nova resposta parcial não deve degradar evidência já confirmada.
 * Ordem: DJEN / portal oficial TJPR > DataJud > notificação recebida.
 * Notificação nunca é promovida a oficial sem resposta efetiva de uma fonte.
 */
export type HearingEvidence=Record<string,unknown>;
const rank=(source:unknown):number=>
 source==='DJEN'||source==='TJPR PROJUDI'?3:
 source==='DataJud'?2:source==='NOTIFICACAO'?1:0;

export function mergeHearingEvidence(
 stored:HearingEvidence|null|undefined,
 incoming:HearingEvidence,
):HearingEvidence|null{
 if(!stored)return {...incoming};
 if(rank(incoming.fonte)<rank(stored.fonte))return null;
 const merged={...incoming};
 for(const field of ['meeting_url','hora_local','hora_fim','data_fim','fuso','fonte_url','portal_url']){
  const next=merged[field];
  const last=stored[field];
  if((next===null||next===undefined||next==='')&&last!==null&&last!==undefined&&last!==''){
    merged[field]=last;
  }
 }
 if(merged.modalidade==='nao_informada'&&
   (stored.modalidade==='presencial'||stored.modalidade==='virtual')){
   merged.modalidade=stored.modalidade;
 }
 if(rank(incoming.fonte)===rank(stored.fonte)&&
    typeof stored.evidencia==='string'&&
    typeof incoming.evidencia==='string'&&
    incoming.evidencia.length<stored.evidencia.length/4){
   merged.evidencia=stored.evidencia;
 }
 return merged;
}
