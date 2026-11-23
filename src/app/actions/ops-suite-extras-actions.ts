'use server';

import {getUserContext,getSupabaseAdmin} from '@/lib/server-db';
import {canUseOpsCapability,type OpsCapability} from '@/lib/ops-suite/policy';

async function guarded(cap:OpsCapability){
 const ctx=await getUserContext();
 if(!ctx.auth_id||!ctx.empresa_id)throw new Error('Sessão expirada.');
 const db=await getSupabaseAdmin();
 const {data,error}=await db.from('lexis_ops_grants').select('capability,allowed')
  .eq('empresa_id',ctx.empresa_id).eq('user_auth_id',ctx.auth_id).eq('capability',cap).maybeSingle();
 if(error||!canUseOpsCapability({cargo:ctx.cargo,isSuperAdmin:ctx.isSuperAdmin,isSupervisor:ctx.isSupervisor},cap,data))
  throw new Error('Sem permissão para esta consulta.');
 return {db,company:ctx.empresa_id,user:ctx.auth_id};
}
function safeId(raw:unknown){
 const id=String(raw||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Identificador inválido.');
 return id;
}
export async function listOpsInboxNotesAction(threadId:string){
 const a=await guarded('inbox.read');
 const id=safeId(threadId);
 const {data:thread}=await a.db.from('lexis_ops_inbox').select('id')
  .eq('empresa_id',a.company).eq('id',id).maybeSingle();
 if(!thread)throw new Error('Atendimento não encontrado.');
 const {data,error}=await a.db.from('lexis_ops_audit').select('actor_auth_id,event,details,created_at')
 .eq('empresa_id',a.company).eq('entity','inbox').eq('entity_id',id)
 .order('created_at',{ascending:false}).limit(70);
 if(error)throw new Error(error.message);return data||[];
}
export async function listOpsAuditAction(){
 const a=await guarded('permissions.manage');
 const {data,error}=await a.db.from('lexis_ops_audit').select('id,actor_auth_id,entity,entity_id,event,created_at')
  .eq('empresa_id',a.company).order('created_at',{ascending:false}).limit(120);
 if(error)throw new Error(error.message);return data||[];
}
export async function getOpsAttachmentLinkAction(submissionId:string,path:string){
 const a=await guarded('intake.review');
 const id=safeId(submissionId);
 const {data,error}=await a.db.from('lexis_ops_submissions').select('attachments')
  .eq('empresa_id',a.company).eq('id',id).maybeSingle();
 if(error||!data||!Array.isArray(data.attachments)||!data.attachments.includes(path))
  throw new Error('Arquivo não pertence a esta resposta.');
 if(!path.startsWith(a.company+'/'))throw new Error('Arquivo fora da empresa.');
 const {data:link,error:storageError}=await a.db.storage.from('lexis-intake-private')
  .createSignedUrl(path,60);
 if(storageError||!link?.signedUrl)throw new Error('Não foi possível liberar acesso temporário.');
 return {url:link.signedUrl,expiresInSeconds:60};
}
export async function getOpsCallTranscriptAction(id:string){
 const a=await guarded('calls.read');
 const {data,error}=await a.db.from('lexis_ops_calls')
  .select('transcript,consent_at,transcript_source')
  .eq('empresa_id',a.company).eq('id',safeId(id)).maybeSingle();
 if(error||!data)throw new Error('Registro indisponível.');
 if(data.transcript&&!data.consent_at)throw new Error('Transcrição sem consentimento registrado; revisão necessária.');
 return {transcript:data.transcript||'',source:data.transcript_source||'',consentAt:data.consent_at};
}
