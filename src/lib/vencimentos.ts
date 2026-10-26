import {isCasoEncerrado} from "@/lib/status-encerrado";
import {diasAtePrazo,normalizarDataPrazo} from "@/lib/prazo-status";

/** Uma única regra operacional para todas as listas de vencidos.
 *
 * proximo_retorno é o agendamento atual e tem precedência sobre o alias
 * proximoPrazo mapeado das listas. proximo_prazo é um campo legado distinto:
 * pode conter uma data antiga de 2026 mesmo depois do último atendimento.
 * Nunca usar o campo legado para concluir que um atendimento está vencido
 * ou que ocorreu perda de prazo judicial.
 */
export type CaseVencimento={
 status?:string|null;statusManual?:string|null;status_interno?:string|null;
 situacao?:string|null;proximoPrazo?:string|null;proximoRetorno?:string|null;
 ultimoRetorno?:string|null;proximo_prazo?:string|null;proximo_retorno?:string|null;
 ultimo_retorno?:string|null;dados?:unknown;
};
function asDate(s:unknown):string|null{
 return typeof s==="string"?normalizarDataPrazo(s):null;
}
export function classificarVencimento(c:CaseVencimento,hoje?:string){
 const empty={vencido:false,retorno:false,prazo:false,revisar:false,
  historico:false,inconsistencia:false,marcado:false,excluido:true,dias:null as number|null};
 if(isCasoEncerrado(c))return empty;
 const retorno=asDate(c.proximo_retorno)||asDate(c.proximoRetorno)||asDate(c.proximoPrazo);
 const ultimo=asDate(c.ultimo_retorno)||asDate(c.ultimoRetorno);
 const historicoPrazo=asDate(c.proximo_prazo);
 const dr=diasAtePrazo(retorno,hoje);
 const dp=diasAtePrazo(historicoPrazo,hoje);
 const vencido=dr!==null&&dr<0&&(!ultimo||!!retorno&&ultimo<retorno);
 // Status anterior não prova atraso: é somente um alerta de qualidade cadastral.
 const marcado=/^(vencido|caso cr[ií]tico)$/i.test(String(c.status||c.statusManual||"").trim());
 const inconsistencia=marcado!==vencido;
 const historico=dp!==null&&dp<0&&!vencido&&(
  !retorno||(diasAtePrazo(retorno,hoje)??-1)>=0
 );
 return {
  vencido,retorno:vencido,
  // Flag histórica separada da fila; o antigo campo nunca define vencimento.
  prazo:historico,revisar:inconsistencia,historico,inconsistencia,
  marcado,excluido:false,dias:dr
 };
}
/** Métrica do painel: status cadastrado pela equipe, não atraso inferido.
 * A flag pode estar desatualizada; jamais usar sozinha para envio automático.
 */
export function isVencidoNoCRM(c:CaseVencimento){
 const d=(c.dados&&typeof c.dados==="object"?c.dados:{} ) as Record<string,unknown>;
 // Coluna status é a fonte canônica do CRM. O JSON legado só é usado
 // se ela estiver ausente; não deixar dados.status velho se sobrepor ao banco.
 const raw=(c as CaseVencimento&{status_crm?:string|null}).status_crm ?? c.status ?? d.status;
 return /^(vencido|caso cr[ií]tico)$/i.test(String(raw||"").trim());
}
export function isVencidoAcionavelCRM(c:CaseVencimento){
 return isVencidoNoCRM(c)&&!isCasoEncerrado(c);
}
export function isCasoVencido(c:CaseVencimento,hoje?:string){
 return classificarVencimento(c,hoje).vencido;
}

/** Métrica distinta para evitar tratar status do CRM como "prazo perdido".
 * todos: marcações salvas no CRM (mesmo contrato da RPC atual);
 * ativosMarcados: exclui encerramentos manuais;
 * retorno: data do retorno ao cliente realmente atrasada.
 * As categorias podem se sobrepor e NUNCA devem ser somadas.
 */
export function resumirCentralVencidos(
 rows: ReadonlyArray<CaseVencimento & {flag: ReturnType<typeof classificarVencimento>}>
){
 let todos=0,ativosMarcados=0,retorno=0,prazo=0,revisar=0,encerradosMarcados=0;
 for(const p of rows){
  const marcado=isVencidoNoCRM(p);
  // Este total representa MARCAÇÕES no CRM, igual à RPC de KPI.
  // A fila acionável exclui encerramentos manuais sem ocultá-los.
  if(marcado){
   todos++;
   if(p.flag.excluido)encerradosMarcados++;
   else ativosMarcados++;
  }
  if(p.flag.retorno)retorno++;
  if(p.flag.historico)prazo++;
  if(p.flag.inconsistencia||(marcado&&p.flag.excluido))revisar++;
 }
 return {todos,ativosMarcados,retorno,prazo,revisar,encerradosMarcados};
}
