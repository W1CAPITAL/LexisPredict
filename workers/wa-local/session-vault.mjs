import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';

/** Encrypted authentication snapshots for ephemeral Render Free instances. */
export function createSessionVault({api,token,dir}){
 const key=Buffer.from(token,'hex');
 let restored=false,pending=null,uploading=false,dirty=false;
 const valid=name=>/^[a-zA-Z0-9_.-]{1,240}\.json$/.test(name)&&!name.startsWith('..');
 function encrypt(clear){
   const iv=randomBytes(12),enc=createCipheriv('aes-256-gcm',key,iv);
   const body=Buffer.concat([enc.update(clear),enc.final()]);
   return ['wa1',iv.toString('base64'),enc.getAuthTag().toString('base64'),body.toString('base64')].join(':');
 }
 function decrypt(payload){
   const [version,iv64,tag64,body64]=String(payload||'').split(':');
   if(version!=='wa1'||!iv64||!tag64||!body64)throw Error('Backup inválido');
   const iv=Buffer.from(iv64,'base64'),tag=Buffer.from(tag64,'base64');
   if(iv.length!==12||tag.length!==16)throw Error('Chaves de sessão inválidas');
   const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
   return Buffer.concat([decipher.update(Buffer.from(body64,'base64')),decipher.final()]);
 }
 async function restore(){
   if(restored)return;
   await mkdir(dir,{recursive:true});
   // Do not create a new WhatsApp session if the cloud backup cannot be fetched.
   const remote=await api({type:'session_restore'});
   if(remote.sealed){
     const snapshot=JSON.parse(decrypt(remote.sealed).toString('utf8'));
     if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('Formato da sessão incorreto');
     const list=Object.entries(snapshot);
     if(list.length>220)throw Error('Sessão excede limite de arquivos');
     for(const [name,content] of list){
       if(!valid(name)||typeof content!=='string'||content.length>130000)throw Error('Arquivo de sessão inválido');
       await writeFile(join(dir,name),content,'utf8');
     }
     console.log('Sessão WA.Auto recuperada do backup criptografado.');
   }
   restored=true;
 }
 async function upload(){
   if(uploading){dirty=true;return;}
   uploading=true;
   try{
     const files=(await readdir(dir)).filter(valid),state={};let size=0;
     if(files.length>220)throw Error('Arquivos de autenticação em excesso');
     for(const name of files){
       const content=await readFile(join(dir,name),'utf8');
       if(content.length>130000)throw Error('Arquivo de autenticação muito grande');
       size+=content.length;
       if(size>1150000)throw Error('Backup de sessão excede limite');
       state[name]=content;
     }
     if(!state['creds.json'])return;
     await api({type:'session_backup',sealed:encrypt(Buffer.from(JSON.stringify(state)))});
   }catch(e){console.error('Backup de sessão não concluído:',String(e?.message||e).slice(0,150));}
   finally{
     uploading=false;
     if(dirty){dirty=false;schedule();}
   }
 }
 function schedule(){
   if(!restored)return;
   clearTimeout(pending);
   pending=setTimeout(()=>void upload(),5000);
 }
 async function clear(){
   clearTimeout(pending);
   restored=false;
   await api({type:'session_clear'});
   await rm(dir,{recursive:true,force:true});
 }
 return {restore,schedule,clear};
}
