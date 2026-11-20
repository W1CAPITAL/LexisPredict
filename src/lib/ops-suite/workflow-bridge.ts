import type {LegalWorkflow} from '@/lib/crm-agent/legal-workflow';

export function toPersistedWorkflowSteps(
 workflow:Pick<LegalWorkflow,'steps'>,cnj:string,empresaId:string,actor:string,processoId:number
){
 const unique=new Set<string>();
 return workflow.steps.filter(step=>{
  if(unique.has(step.id))return false;
  unique.add(step.id);return true;
 }).map(step=>({
  empresa_id:empresaId,processo_id:processoId,cnj,
  step_key:step.id,title:step.title,description:step.detail,
  priority:step.priority==='critical'?'critica':step.priority==='high'?'alta':'normal',
  status:'pendente',assigned_auth_id:null,due_at:null,evidence_url:null,
  created_by:actor
 }));
}
