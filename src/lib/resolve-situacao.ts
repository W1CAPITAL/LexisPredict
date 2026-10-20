/**
 * Colunas tipadas em public.processos são a fonte operacional de verdade.
 * JSON dados e identificadores importados só entram quando não há status tipado.
 * Assim um encerramento/reabertura não é desfeito visualmente por JSON antigo.
 */
const STRONG=/ENCERRAD|ARQUIVAD|EXTINT|BAIXA\s*DEFINITIVA|FINALIZAD|SUSPENS/;
const PRAZO=/^(VENCIDO|É HOJE|E HOJE|ATENÇÃO|ATENCAO|NO PRAZO|SEM PRAZO|CASO CR[IÍ]TICO)$/;

function situacaoNormalizada(value:unknown):string{
 const u=String(value??"").trim().toUpperCase();
 if(!u)return "";
 if(STRONG.test(u)){
  if(/ENCERRAD|ARQUIV|FINALIZ|BAIXA\s*DEFINITIVA/.test(u))return "ENCERRADO";
  if(/EXTINT/.test(u))return "EXTINTO";
  if(/SUSPENS/.test(u))return "SUSPENSO";
 }
 if(PRAZO.test(u))return "EM ANDAMENTO";
 return u;
}
export function resolveSituacaoFromRow(item:any,dados?:any):string{
 const d=dados&&typeof dados==="object"?dados:
  (item?.dados&&typeof item.dados==="object"?item.dados:{});
 const typedStatus=String(item?.status||"").trim().toUpperCase();
 // Um status final do processo tem prioridade absoluta sobre o blob antigo.
 if(STRONG.test(typedStatus))return situacaoNormalizada(typedStatus);
 // A reabertura explícita salva status e status_interno tipados. O valor antigo
 // d.situacao='ENCERRADO' não deve reverter a operação.
 const typedInternal=String(item?.status_interno||"").trim();
 if(typedInternal)return situacaoNormalizada(typedInternal);
 if(d.via_scan_auto_encerrar||item?.via_scan_auto_encerrar||
   d.operacao_sistema?.tipo==="SCAN_AUTO_ENCERRAR")return "ENCERRADO";
 return situacaoNormalizada(d.situacao||d.SITUACAO||d.status_interno||d.statusManual||d.STATUS_MANUAL||typedStatus||d.status)||"EM ANDAMENTO";
}
export function resolveStatusManualFromRow(item:any,dados?:any,situacao?:string):string{
 const d=dados&&typeof dados==="object"?dados:
  (item?.dados&&typeof item.dados==="object"?item.dados:{});
 const resolved=String(situacao||resolveSituacaoFromRow(item,d)).toUpperCase();
 if(STRONG.test(resolved))return /ARQUIV/.test(resolved)?"Arquivado":"Encerrado";
 // Quando a linha tipada está ativa, uma marca antiga no JSON não pode
 // sobrepor o cálculo do próximo retorno.
 const typed=String(item?.status||"");
 if(typed&&PRAZO.test(typed.toUpperCase()))return "Automatico";
 const m=String(d.statusManual||d.STATUS_MANUAL||"Automatico");
 return STRONG.test(m.toUpperCase())?"Automatico":m;
}
