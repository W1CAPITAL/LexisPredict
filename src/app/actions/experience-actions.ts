"use server";

import {createHash} from 'node:crypto';
import {getSupabaseAdmin,getUserContext} from '@/lib/server-db';
import {EXPERIENCE_VERSION,cleanExperiencePrefs,type ExperiencePreferences} from '@/lib/experience-prefs';
import {EXPERIENCE_TERMS_VERSION,EXPERIENCE_TERMS_TEXT} from '@/lib/experience-terms';
import {normalizedPhone} from '@/lib/whatsapp-local';

async function currentActor(){
 const ctx=await getUserContext();
 if(!ctx?.auth_id||!ctx?.empresa_id)throw Error('É preciso estar autenticado e vinculado a uma empresa.');
 const db=await getSupabaseAdmin();
 const {data:user,error}=await db.from('usuarios')
  .select('id,auth_user_id,empresa_id,nome,cargo,email,avatar_url')
  .eq('auth_user_id',ctx.auth_id).eq('empresa_id',ctx.empresa_id).maybeSingle();
 if(error||!user)throw Error('Perfil da organização não encontrado.');
 return {db,user,uid:String(ctx.auth_id),tenant:String(ctx.empresa_id)};
}

export async function getExperienceAction(){
 try{
  const {db,user,uid}=await currentActor();
  const {data,error}=await db.from('lexis_user_experience')
   .select('display_name,display_role,phone,preferences,onboarding_version,terms_version,terms_accepted_at,signature_name,welcome_opt_in,welcome_status')
   .eq('auth_user_id',uid).maybeSingle();
  if(error)throw Error(error.message);
  return {ok:true as const,version:EXPERIENCE_VERSION,profile:data,
   user:{nome:user.nome,cargo:user.cargo,email:user.email,avatar_url:user.avatar_url}};
 }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Falha no perfil'}}
}

type ExperienceSaveInput={
 name:string;roleLabel:string;phone:string;preferences:ExperiencePreferences;
 complete?:boolean;acceptTerms?:boolean;signature?:string;welcomeOptIn?:boolean;
};

export async function saveExperienceAction(input:ExperienceSaveInput){
 try{
  const {db,uid,tenant,user}=await currentActor();
  const name=String(input?.name||'').trim().replace(/\s+/g,' ').slice(0,100);
  const roleLabel=String(input?.roleLabel||'').trim().replace(/\s+/g,' ').slice(0,70);
  if(name.length<3||name.length>100)throw Error('Informe seu nome completo.');
  const phone=normalizedPhone(input?.phone);
  if(!phone)throw Error('WhatsApp obrigatório: informe DDD + número brasileiro válido.');
  const prefs=cleanExperiencePrefs(input.preferences);
  const {data:old,error:oldErr}=await db.from('lexis_user_experience')
    .select('onboarding_version,terms_version,terms_accepted_at,welcome_status,phone')
    .eq('auth_user_id',uid).maybeSingle();
  if(oldErr)throw Error('Não foi possível validar o cadastro.');
  const complete=input.complete===true;
  if(complete){
   if(!input.acceptTerms)throw Error('Leia e aceite os termos antes de assinar.');
   const signedName=String(input.signature||'').trim().replace(/\s+/g,' ');
   if(signedName.toLocaleLowerCase('pt-BR')!==name.toLocaleLowerCase('pt-BR'))
    throw Error('Digite seu nome completo na assinatura como informado no perfil.');
   const hash=createHash('sha256').update(EXPERIENCE_TERMS_TEXT).digest('hex');
   const {error:signErr}=await db.from('lexis_user_legal_acceptances').upsert({
    auth_user_id:uid,empresa_id:tenant,contract_version:EXPERIENCE_TERMS_VERSION,
    contract_sha256:hash,signed_name:signedName,
   },{onConflict:'auth_user_id,contract_version'});
   if(signErr)throw Error('Não foi possível registrar o aceite contratual: '+signErr.message);
  }
  const now=new Date().toISOString();
  const payload={
   auth_user_id:uid,empresa_id:tenant,display_name:name,
   display_role:roleLabel||String(user.cargo||'Colaborador'),phone,preferences:prefs,
   onboarding_version:complete?EXPERIENCE_VERSION:Number(old?.onboarding_version||0),
   terms_version:complete?EXPERIENCE_TERMS_VERSION:old?.terms_version||null,
   terms_accepted_at:complete?(old?.terms_version===EXPERIENCE_TERMS_VERSION?old.terms_accepted_at:now):old?.terms_accepted_at||null,
   signature_name:complete?name:null,
   welcome_opt_in:complete&&input.welcomeOptIn===true,
   welcome_status:complete&&input.welcomeOptIn===true&&old?.welcome_status!=='sent'
    &&old?.welcome_status!=='queued'?'waiting':old?.welcome_status||'not_requested',
   updated_at:now,
  };
  const {error:saveErr}=await db.from('lexis_user_experience').upsert(payload,{onConflict:'auth_user_id'});
  if(saveErr)throw Error('Não foi possível salvar as preferências: '+saveErr.message);
  // Display name is user-controlled. The real permission/cargo is NOT.
  const {error:userErr}=await db.from('usuarios').update({nome:name,...(prefs.avatarUrl?{avatar_url:prefs.avatarUrl}:{})})
   .eq('auth_user_id',uid).eq('empresa_id',tenant);
  if(userErr)console.error('[experience] profile name sync',userErr.code);
  return {ok:true as const,completed:complete,preferences:prefs};
 }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Não foi possível salvar'}}
}

export async function uploadExperienceImageAction(base64:string,kind:'avatar'|'wallpaper'){
 try{
  const {db,uid,tenant}=await currentActor();
  const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(base64||'');
  if(!m||!['avatar','wallpaper'].includes(kind))throw Error('Envie PNG, JPG ou WebP.');
  const bytes=Buffer.from(m[2],'base64');
  if(bytes.length<32||bytes.length>3*1024*1024)throw Error('A imagem deve ter até 3 MB.');
  const signatures={
   png:bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,
   jpeg:bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
   webp:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',
  };
  const ext=m[1] as 'png'|'jpeg'|'webp';
  if(!signatures[ext])throw Error('Conteúdo do arquivo não corresponde ao formato.');
  const name=tenant+'/'+uid+'/'+kind+'-'+Date.now()+'.'+(ext==='jpeg'?'jpg':ext);
  const {error}=await db.storage.from('lexis-experience').upload(name,bytes,{
   contentType:'image/'+ext,upsert:false,cacheControl:'3600',
  });
  if(error)throw Error('Falha no upload: '+error.message);
  const {data}=db.storage.from('lexis-experience').getPublicUrl(name);
  return {ok:true as const,url:data.publicUrl};
 }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Upload indisponível'}}
}
