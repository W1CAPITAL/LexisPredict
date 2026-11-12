import {resolveRole, type RoleLike} from '@/lib/roles';

export const OPS_CAPABILITIES = [
 'workflow.read','workflow.write','inbox.read','inbox.assign',
 'agents.read','agents.edit','agents.publish','intake.manage',
 'intake.review','calls.read','calls.record','integrations.read','integrations.check',
 'permissions.manage'
] as const;
export type OpsCapability=(typeof OPS_CAPABILITIES)[number];
export type OpsGrant={capability:OpsCapability;allowed:boolean};
export type IntakeField={key:string;label:string;type:'text'|'email'|'phone'|'textarea';required:boolean};

const ADMIN_ONLY=new Set<OpsCapability>(['permissions.manage']);
const ROLE_CAPABILITIES:Record<string,OpsCapability[]>={
 Superadmin:[...OPS_CAPABILITIES],
 Supervisor:[...OPS_CAPABILITIES],
 Administrador:[...OPS_CAPABILITIES],
 Operador:['workflow.read','workflow.write','inbox.read','inbox.assign','agents.read','intake.review','calls.read','calls.record','integrations.read'],
 Visualizador:['workflow.read','inbox.read','agents.read','integrations.read']
};

export function canUseOpsCapability(role:RoleLike, capability:OpsCapability, override?:OpsGrant|null):boolean{
 const resolved=resolveRole(role);
 if(resolved==='Desconhecido')return false;
 if(ADMIN_ONLY.has(capability))return (ROLE_CAPABILITIES[resolved]||[]).includes(capability);
 if(override&&override.capability===capability)return override.allowed===true;
 return (ROLE_CAPABILITIES[resolved]||[]).includes(capability);
}

export function normalizeOpsPhone(raw:string):string{
 const digits=String(raw||'').replace(/\D/g,'');
 const phone=digits.startsWith('55')?digits:'55'+digits;
 if(!/^55[1-9]{2}9?\d{8}$/.test(phone))throw new Error('Telefone brasileiro inválido com DDD.');
 return phone;
}

export function normalizeOpsCnj(raw:string):string{
 const digits=String(raw||'').replace(/\D/g,'');
 if(!/^\d{20}$/.test(digits))throw new Error('Informe CNJ com 20 dígitos.');
 return digits;
}

const AGENT_TOOLS=['read_case','suggest_tasks','draft_message','lookup_official'] as const;
export type OpsAgentDraft={name:string;instructions:string;tools:string[];maxCalls:number;humanReview:boolean};
export function validateOpsAgentDraft(input:OpsAgentDraft):OpsAgentDraft{
 const name=String(input.name||'').trim().slice(0,100);
 const instructions=String(input.instructions||'').trim().slice(0,6000);
 if(name.length<3||instructions.length<3)throw new Error('Informe nome e instruções do agente.');
 if(!Array.isArray(input.tools)||input.tools.some(tool=>!AGENT_TOOLS.includes(tool as any)))throw new Error('Ferramenta não autorizada.');
 if(!Number.isInteger(input.maxCalls)||input.maxCalls<1||input.maxCalls>25)throw new Error('Limite por execução deve estar entre 1 e 25.');
 if(input.humanReview!==true)throw new Error('Revisão humana obrigatória.');
 return {name,instructions,tools:[...new Set(input.tools)].slice(0,4),maxCalls:input.maxCalls,humanReview:true};
}

export function validateIntakeAnswers(fields:IntakeField[],input:Record<string,unknown>):Record<string,string>{
 if(!Array.isArray(fields)||fields.length>30)throw new Error('Formulário inválido.');
 const output:Record<string,string>={};
 const allowed=new Set(fields.map(f=>f.key));
 if(Object.keys(input||{}).some(key=>!allowed.has(key)))throw new Error('Campo inesperado no formulário.');
 for(const field of fields){
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(field.key)||!['text','textarea','email','phone'].includes(field.type))throw new Error('Configuração de campo inválida.');
  const value=String(input?.[field.key]??'').trim();
  if(field.required&&!value)throw new Error('Preencha '+field.label+'.');
  if(value.length>(field.type==='textarea'?3000:240))throw new Error('Campo muito longo: '+field.label);
  if(field.type==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('E-mail inválido.');
  if(field.type==='phone'&&value)normalizeOpsPhone(value);
  output[field.key]=value;
 }
 return output;
}

export function eligibleForRecording(consentedAt:string|null|undefined,transcript:string):boolean{
 return !String(transcript||'').trim() || Boolean(consentedAt&&Number.isFinite(Date.parse(consentedAt)));
}
