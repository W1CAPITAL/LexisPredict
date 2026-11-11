/** Estado de uma fonte de movimentos do tribunal.
 * Não confundir disponibilidade do WSDL com consulta judicial concluída.
 */
export type CourtScannerView={
 adapter:string;status:string;httpStatus:number|null;checkedAt:string|null;
 verifiedAt:string|null;movements:number;nextAllowedAt:string|null;
 sourceIssueUntil:string|null;
};
export function describeCourtScanner(view:CourtScannerView,now=new Date()){
 const valid=(raw:string|null):number=>{
  const parsed=Date.parse(String(raw||''));
  return Number.isFinite(parsed)?parsed:0;
 };
 const lastSuccess=valid(view.verifiedAt);
 const currentVerified=(view.status==='verified'||view.status==='verified_empty')&&lastSuccess>0;
 const verified=lastSuccess>0&&view.movements>0;
 const failed=['unavailable','restricted','rate_limited','timeout','unexpected_response','cnj_mismatch'].includes(view.status);
 const hold=valid(view.sourceIssueUntil)|| (failed?valid(view.nextAllowedAt):0);
 const blocked=hold>now.getTime();
 const source=view.adapter==='tjpr-scmpp'?'TJPR · SCMPP':
  view.adapter==='tjpe-mni'?'TJPE · PJe/MNI':'Tribunal não identificado';
 let message='';
 if(currentVerified){
  message=view.movements>0?
   'Movimentações públicas confirmadas pelo serviço oficial.':
   'Serviço oficial respondeu, sem movimentos públicos na resposta.';
 }else if(verified){
  message='Há movimentos oficiais de consulta anterior; a última tentativa não os reconfirmou.';
 }else if(view.status==='pending'||view.status==='checking'){
  message='Processo aguardando execução da consulta automática do tribunal.';
 }else if(failed){
  message=view.httpStatus===500?'Serviço SOAP do tribunal retornou HTTP 500, sem movimentos confirmados.':
   'O conector não confirmou movimentações nesta consulta.';
 }else {
  message='O scanner ainda não confirmou movimentos deste processo.';
 }
 if(blocked)message+=' Fonte em pausa automática para evitar consultas repetidas.';
 return {source,verified,currentVerified,blocked,holdUntil:blocked?new Date(hold).toISOString():null,message,movements:view.movements};
}
