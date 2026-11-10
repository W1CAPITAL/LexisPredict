import type {HermesOfficeMetrics} from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
/** Remove visible Markdown controls from previous free-form model outputs and print/PDF copy.
 * Data does not become evidence merely because it is rendered in a document. */
export function cleanHermesReportText(input:unknown):string {
 return String(input??'')
  .replace(/<[^>]+>/g,' ')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
  .replace(/\*\*|__|\*|\`|~~/g,'')
  .replace(/^\s{0,3}#{1,6}\s*/gm,'')
  .replace(/^\s*[-•]+\s+/gm,'')
  .replace(/\|/g,' · ')
  .replace(/[\u0000-\u0009\u000b-\u001f]/g,' ')
  .split('\n').map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean)
  .join('\n').slice(0,4500);
}
type Evidence=Pick<HermesPortfolioDiagnostics,'overdueReturns'|'registeredDeadlinesDue'|'staleSources'|'merits'|'recommendations'> &
  {unmatchedAssigneeTasks?:number};
const amount=(x:unknown)=>Number.isFinite(Number(x))?Math.max(0,Math.floor(Number(x))):0;
const num=(x:unknown)=>amount(x).toLocaleString('pt-BR');
/** Four auditable virtual roles, NOT a transcript of real people or an LLM-written court opinion.
 * Same input => same text; changed evidence => changed agenda automatically.
 */
export function buildHermesVerifiedMeeting(m:Partial<HermesOfficeMetrics>,day:string,evidence:Evidence|null):string {
 const overdue=amount(evidence?.overdueReturns??m.overdue);
 const stale=amount(evidence?.staleSources??m.staleSources);
 const inconsistent=amount((evidence as unknown as {invalidReturnDates?:number}|null)?.invalidReturnDates);
 const unlinked=amount(evidence?.unmatchedAssigneeTasks);
 const items=[
  'Gerência: Síntese automatizada de '+day+': '+num(m.active)+' processos abertos e '+num(overdue)+' retornos válidos pendentes. '+(inconsistent?'Foram identificadas '+num(inconsistent)+' datas de retorno inconsistentes, sem classificá-las como atrasos.':'Não há retorno vencido na janela administrativa válida.') ,
  'Supervisão: Qualidade das fontes: '+num(stale)+' registros com consulta judicial desatualizada; '+num(m.readyReviews)+' verificações completas e '+num(m.unavailableReviews)+' revisões parciais ou indisponíveis. A falha de fonte não comprova ausência de movimentação.',
  'Processos: Há '+num(evidence?.registeredDeadlinesDue)+' datas de prazo no campo do CRM que exigem conferência no tribunal; isso não comprova qualquer vencimento de prazo judicial. '+(evidence?.merits?'Resultados de mérito são indicações cadastrais, e não sentença definitiva.':'Nenhuma conclusão judicial automática foi produzida.'),
  'Comunicação: '+num(m.contacts30d)+' contatos marcados como realizados nos registros em 30 dias e '+num(m.draftMessages)+' rascunhos preparados. '+(unlinked?'Existem '+num(unlinked)+' tarefas abertas cujo responsável não corresponde ao cadastro atual; revisar os vínculos. ':'')+'Nenhuma mensagem foi enviada nesta reunião.',
 ];
 const suggestion=evidence?.recommendations?.find(x=>x.priority==='Alta'||x.priority==='Atenção');
 if(suggestion)items.push('Encaminhamento: '+cleanHermesReportText(suggestion.title)+'. '+cleanHermesReportText(suggestion.action));
 return items.map(cleanHermesReportText).join('\n').slice(0,4500);
}
