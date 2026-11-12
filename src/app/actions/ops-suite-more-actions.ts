'use server';

import {randomBytes,createHash} from 'node:crypto';
import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {canUseOpsCapability,normalizeOpsCnj,opsCnjVariants,normalizeOpsPhone,eligibleForRecording,type IntakeField,type OpsCapability} from '@/lib/ops-suite/policy';

async function permitted(cap:OpsCapability){
 const ctx=await getUserContext();
 if(!ctx.auth_id||!ctx.empresa_id)throw new Error('Sessão não autenticada.');
 const db=await getSupabaseAdmin();
 const {data:grant,error}=await db.from('lexis_ops_grants').select('capability,allowed')
  .eq('empresa_id',ctx.empresa_id).eq('user_auth_id',ctx.auth_id).eq('capability',cap).maybeSingle();
 if(error)throw new Error('Não foi possível verificar as permissões.');
 if(!canUseOpsCapability({cargo:ctx.cargo,isSupervisor:ctx.isSupervisor,isSuperAdmin:ctx.isSuperAdmin},cap,grant))
  throw new Error('Você não tem permissão para esta operação.');
 return {ctx,db,company:String(ctx.empresa_id),user:String(ctx.auth_id)};
}
const short=(v:unknown,n=300)=>String(v??'').trim().slice(0,n);
const uuid=(v:unknown)=>{
 const s=String(v||'');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))throw new Error('Identificador inválido.');
 return s;
};
async function audit(a:Awaited<ReturnType<typeof permitted>>,entity:string,id:string,event:string,details:Record<string,unknown>={}){
 const {error}=await a.db.from('lexis_ops_audit').insert({
  empresa_id:a.company,actor_auth_id:a.user,entity,entity_id:id,event,details
 });
 if(error)throw new Error('Falha ao registrar auditoria.');
}

export async function createOpsIntakeFormAction(input:{title:string;fields:IntakeField[];expiresInDays:number;maxSubmissions:number}){
 const a=await permitted('intake.manage');
 const title=short(input.title,200);
 if(title.length<3||!Array.isArray(input.fields)||input.fields.length<1||input.fields.length>20)throw new Error('Formulário inválido.');
 const seen=new Set<string>();
 for(const f of input.fields){
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(f.key)||seen.has(f.key)||!['text','email','phone','textarea'].includes(f.type)||!short(f.label,80))
   throw new Error('Campo duplicado ou inválido.');
  seen.add(f.key);
 }
 if(!Number.isInteger(input.expiresInDays)||input.expiresInDays<1||input.expiresInDays>90)throw new Error('Validade permitida: de 1 a 90 dias.');
 if(!Number.isInteger(input.maxSubmissions)||input.maxSubmissions<1||input.maxSubmissions>1000)throw new Error('Limite de respostas inválido.');
 const token=randomBytes(32).toString('base64url');
 const tokenHash=createHash('sha256').update(token).digest('hex');
 const expires=new Date(Date.now()+input.expiresInDays*86400000).toISOString();
 const {data,error}=await a.db.from('lexis_ops_forms').insert({
  empresa_id:a.company,title,fields:input.fields,token_hash:tokenHash,
  expires_at:expires,max_submissions:input.maxSubmissions,created_by:a.user
 }).select('id').single();
 if(error)throw new Error(error.message);
 await audit(a,'form',data.id,'created',{expires_at:expires,max_submissions:input.maxSubmissions});
 return {ok:true,id:data.id,publicPath:'/intake/'+token,expiresAt:expires};
}
export async function listOpsIntakeFormsAction(){
 const a=await permitted('intake.manage');
 const {data,error}=await a.db.from('lexis_ops_forms')
  .select('id,title,status,fields,expires_at,max_submissions,submissions_count,created_at')
  .eq('empresa_id',a.company).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error(error.message);return data||[];
}
export async function revokeOpsIntakeFormAction(id:string){
 const a=await permitted('intake.manage');
 const formId=uuid(id);
 const {data,error}=await a.db.from('lexis_ops_forms').update({status:'revogado'})
  .eq('empresa_id',a.company).eq('id',formId).select('id').maybeSingle();
 if(error||!data)throw new Error('Formulário não encontrado na empresa.');
 await audit(a,'form',formId,'revoked');
 return {ok:true};
}
export async function listOpsIntakeSubmissionsAction(formId?:string){
 const a=await permitted('intake.review');
 let query=a.db.from('lexis_ops_submissions').select('id,form_id,answers,attachments,created_at,reviewed_at')
  .eq('empresa_id',a.company);
 if(formId)query=query.eq('form_id',uuid(formId));
 const {data,error}=await query.order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error(error.message);return data||[];
}
export async function reviewOpsIntakeSubmissionAction(id:string){
 const a=await permitted('intake.review');
 const submissionId=uuid(id);
 const {data,error}=await a.db.from('lexis_ops_submissions')
  .update({reviewed_at:new Date().toISOString(),reviewed_by:a.user})
  .eq('empresa_id',a.company).eq('id',submissionId).select('id').maybeSingle();
 if(error||!data)throw new Error('Resposta não encontrada na empresa.');
 await audit(a,'submission',submissionId,'reviewed');
 return {ok:true};
}
export async function listOpsCallsAction(){
 const a=await permitted('calls.read');
 const {data,error}=await a.db.from('lexis_ops_calls')
 .select('id,phone,cnj,direction,status,provider,notes,transcript_source,consent_at,created_at,created_by')
 .eq('empresa_id',a.company).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error(error.message);return data||[];
}
export async function createOpsCallAction(input:{
 phone:string;cnj?:string;direction:'entrada'|'saida';status:'nao_atendida'|'realizada'|'falhou';
 notes?:string;transcript?:string;consentAt?:string;transcriptSource?:string;
}){
 const a=await permitted('calls.record');
 const phone=normalizeOpsPhone(input.phone);
 const cnj=input.cnj?normalizeOpsCnj(input.cnj):null;
 if(cnj){
  const {data,error}=await a.db.from('processos').select('id').eq('empresa_id',a.company)
   .in('protocolo_ref',opsCnjVariants(cnj)).limit(1).maybeSingle();
  if(error||!data)throw new Error('Processo não localizado na empresa.');
 }
 if(!['entrada','saida'].includes(input.direction)||!['nao_atendida','realizada','falhou'].includes(input.status))
  throw new Error('Direção ou situação da ligação inválida.');
 const transcript=short(input.transcript,20000);
 const consent=input.consentAt&&Number.isFinite(Date.parse(input.consentAt))?input.consentAt:null;
 if(!eligibleForRecording(consent,transcript))throw new Error('É obrigatório registrar consentimento antes da transcrição.');
 const {data,error}=await a.db.from('lexis_ops_calls').insert({
  empresa_id:a.company,phone,cnj,direction:input.direction,status:input.status,
  provider:'manual',notes:short(input.notes,3000),transcript,
  transcript_source:transcript?short(input.transcriptSource,100)||'inserida_pelo_operador':'',
  consent_at:consent,created_by:a.user
 }).select('id').single();
 if(error)throw new Error(error.message);
 await audit(a,'call',data.id,'recorded',{direction:input.direction,status:input.status,has_transcript:!!transcript});
 return {ok:true,id:data.id};
}

const INTEGRATIONS=['datajud','djen','whatsapp_local','google_calendar','ia'] as const;
type IntegrationName=(typeof INTEGRATIONS)[number];
export async function listOpsIntegrationsAction(){
 const a=await permitted('integrations.read');
 const {data,error}=await a.db.from('lexis_ops_integrations')
 .select('id,provider,state,details,checked_at').eq('empresa_id',a.company)
 .order('checked_at',{ascending:false}).limit(30);
 if(error)throw new Error(error.message);return data||[];
}
export async function checkOpsIntegrationAction(provider:IntegrationName){
 const a=await permitted('integrations.check');
 if(!INTEGRATIONS.includes(provider))throw new Error('Integração desconhecida.');
 let state:'configurado'|'nao_configurado'|'falhou'|'desconhecido'='desconhecido';
 let details='Verificação de configuração; não confirma disponibilidade em tempo real.';
 try{
  if(provider==='datajud'||provider==='djen'){
   const column=provider==='datajud'?'datajud_consultado_em':'djen_consultado_em';
   const {data,error}=await a.db.from('processos').select(column)
    .eq('empresa_id',a.company).not(column,'is',null)
    .order(column,{ascending:false}).limit(1);
   if(error)throw error;
   const last=data?.[0]?.[column];
   state=last?'configurado':'desconhecido';
   details=last?'Última consulta registrada na carteira: '+last+'. Não significa serviço online agora.':'Nenhuma consulta confirmada na carteira.';
  }else if(provider==='whatsapp_local'){
   const {data,error}=await a.db.from('wa_local_bridges').select('state,last_seen')
    .eq('empresa_id',a.company).maybeSingle();
   if(error)throw error;
   state=data?.state==='connected'?'configurado':data?'desconhecido':'nao_configurado';
   details=data?'Estado informado pelo dispositivo: '+String(data.state||'indisponível')+
    '. Último contato: '+String(data.last_seen||'não registrado'):'Nenhum dispositivo local vinculado.';
  }else if(provider==='google_calendar'){
   const {data,error}=await a.db.from('google_calendar_connections').select('auth_user_id,updated_at')
    .eq('empresa_id',a.company).eq('auth_user_id',a.user).limit(1);
   if(error)throw error;
   state=data?.length?'configurado':'nao_configurado';
   details=data?.length?'Conexão registrada para usuário. Tokens e acesso externo não foram testados.':'Conexão não registrada para o usuário.';
  }else{
   const hasKey=!!(process.env.MINIMAX_API_KEY||process.env.GROQ_API_KEY||process.env.ANTHROPIC_API_KEY||process.env.OPENROUTER_API_KEY);
   state=hasKey?'configurado':'nao_configurado';
   details=hasKey?'Pelo menos uma chave de motor IA está configurada; nenhuma chamada foi realizada.':'Nenhum dos motores de API previstos está configurado.';
  }
 }catch(e:any){state='falhou';details='Falha na verificação: '+short(e?.message,250);}
 const {error}=await a.db.from('lexis_ops_integrations').upsert({
  empresa_id:a.company,provider,state,details,checked_at:new Date().toISOString(),checked_by:a.user
 },{onConflict:'empresa_id,provider'});
 if(error)throw new Error(error.message);
 await audit(a,'integration',provider,'checked',{state});
 return {ok:true,provider,state,details};
}
