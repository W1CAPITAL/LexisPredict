import {isCasoEncerrado} from "@/lib/status-encerrado";
import {diasAtePrazo} from "@/lib/prazo-status";

/** Fonte compartilhada pelos filtros /cases, /processos, /tarefas e /vencidos.
 * Retorno é compromisso operacional; proximoPrazo é data cadastrada (não
 * necessariamente prazo judicial). Encerrados ficam fora da fila.
 */
export type CaseVencimento = {
 status?:string|null;statusManual?:string|null;status_interno?:string|null;
 situacao?:string|null;proximoPrazo?:string|null;proximoRetorno?:string|null;
 ultimoRetorno?:string|null;proximo_prazo?:string|null;proximo_retorno?:string|null;
 ultimo_retorno?:string|null;dados?:unknown;
};
const date=(s:unknown)=>typeof s==="string"&&s.length?String(s):null;
export function classificarVencimento(c:CaseVencimento,hoje?:string){
 if(isCasoEncerrado(c)) return {vencido:false,retorno:false,prazo:false,revisar:false,dias:null as number|null};
 const retorno=date(c.proximo_retorno)||date(c.proximoRetorno);
 const ultimo=date(c.ultimo_retorno)||date(c.ultimoRetorno);
 const prazo=date(c.proximo_prazo)||date(c.proximoPrazo);
 const dr=diasAtePrazo(retorno,hoje),dp=diasAtePrazo(prazo,hoje);
 // Contato posterior ao vencimento não quita automaticamente prazo judicial;
 // só sinaliza que é necessário revisar a data operacional.
 const retornoAtrasado=dr!==null&&dr<0&&(!ultimo||ultimo<retorno!);
 const prazoPassou=dp!==null&&dp<0;
 const revisar=!!(prazoPassou&&ultimo&&prazo&&ultimo>prazo);
 const marcado=/^(vencido|caso cr[ií]tico)$/i.test(String(c.statusManual||c.status||"").trim());
 return {
  vencido:retornoAtrasado||prazoPassou||marcado,
  retorno:retornoAtrasado,prazo:prazoPassou,revisar,
  dias:Math.min(...[dr,dp].filter((d):d is number=>d!==null&&d<0),0)||0
 };
}
export function isCasoVencido(c:CaseVencimento,hoje?:string){
 return classificarVencimento(c,hoje).vencido;
}
