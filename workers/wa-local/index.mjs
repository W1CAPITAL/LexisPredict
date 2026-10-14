/**
 * LexisPredict WA Local — optional no-subscription linked-device companion.
 * Run on YOUR computer. Authentication state stays on this computer.
 * Never requires Supabase service-role keys, CNPJ or a rented WhatsApp server.
 * Uses an unofficial WhatsApp Web client; avoid bulk messaging.
 */
import 'dotenv/config';
import makeWASocket,{useMultiFileAuthState,DisconnectReason,Browsers} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {createSessionVault} from './session-vault.mjs';

const folder=dirname(fileURLToPath(import.meta.url));
const url=String(process.env.LEXIS_URL||'https://lexispredict.vercel.app').replace(/\/+$/,'');
const token=String(process.env.LEXIS_BRIDGE_TOKEN||'').trim();
const base=url+'/api/whatsapp-local/worker';
if(!/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url))
  throw Error('LEXIS_URL deve utilizar HTTPS ou localhost.');
if(!/^[a-f0-9]{64}$/i.test(token))throw Error('Configure LEXIS_BRIDGE_TOKEN no arquivo .env, gerado no painel do LexisPredict.');

async function api(data){
  const res=await fetch(base,{method:'POST',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json',
  },body:JSON.stringify(data),signal:AbortSignal.timeout(18000)});
  const body=await res.json().catch(()=>({ok:false,error:'Resposta inválida do CRM'}));
  if(!res.ok||!body.ok)throw Error('CRM HTTP '+res.status+': '+String(body.error||'Requisição recusada').slice(0,150));
  return body;
}
const vault=createSessionVault({api,token,dir:join(folder,'session')});
let socket=null;
let isReady=false;
let status='connecting';
let currentQr=null;
let phone=null;
let reconnectTimer=null;
let heartbeatBusy=false;
let prepareBusy=false;
async function prepareScheduledNotices(){
  if(!isReady||prepareBusy)return;
  prepareBusy=true;
  try{const r=await api({type:'prepare'});if(r.queued)console.log('Comunicado registrado na fila.');}
  catch(e){console.error('Preparação automática:',String(e.message||e).slice(0,160));}
  finally{prepareBusy=false;}
}
let pollingBusy=false;
let reconnectAttempts=0;
const receiptJobs=new Map();
const sendInterval=2000;
let lastSend=0;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function heartbeat(){
  if(heartbeatBusy)return;
  heartbeatBusy=true;
  try{await api({type:'status',state:status,qr:currentQr,phone});}
  catch(e){console.error('Não foi possível atualizar o painel:',e.message);}
  finally{heartbeatBusy=false;}
}
function setStatus(next,qr=null,p=null,err=null){
  status=next;isReady=next==='ready';currentQr=qr;phone=p;
  console.log('WhatsApp:',next,err?String(err).slice(0,100):'');
  void api({type:'status',state:next,qr,phone:p,error:err||null})
    .catch(e=>console.error('Status não sincronizado:',e.message));
}
function digits(jid){
  const raw=String(jid||'').split('@')[0].split(':')[0].replace(/\D/g,'');
  const n=(raw.length===10||raw.length===11)?'55'+raw:raw;
  return /^55\d{10,11}$/.test(n)?n:null;
}
function textOf(m){
  const root=m.message?.ephemeralMessage?.message || m.message?.viewOnceMessage?.message || m.message || {};
  return String(root.conversation||root.extendedTextMessage?.text||root.imageMessage?.caption||'').trim().slice(0,8000);
}
async function onIncoming(message){
  const jid=String(message.key?.remoteJid||'');
  if(!jid.endsWith('@s.whatsapp.net'))return; // Never forward groups or status broadcasts.
  const number=digits(jid),content=textOf(message),messageId=String(message.key?.id||'');
  if(!number||!content||!messageId)return;
  try{await api({type:'message',phone:number,text:content,messageId,fromMe:message.key.fromMe===true});}
  catch(e){console.error('Histórico não sincronizado. Não reenvie sem conferir:',e.message);}
}
async function poll(){
  if(!isReady||pollingBusy||!socket)return;
  pollingBusy=true;
  let job=null;
  try{
    const response=await api({type:'claim'});
    job=response.job;
    if(!job)return;
    const dest=digits(String(job.to)+'@s.whatsapp.net');
    if(!dest||!job.body)throw Error('Destino ou mensagem inválida.');
    // Never retry an unknown send after the socket attempted sending.
    await sleep(Math.max(0,sendInterval-(Date.now()-lastSend)));
    lastSend=Date.now();
    let reply;
    try{reply=await socket.sendMessage(dest+'@s.whatsapp.net',{text:job.body});}
    catch(e){
      await api({type:'ack',id:job.id,state:'uncertain',error:'Falha após solicitar envio. Confira WhatsApp antes de repetir.'}).catch(()=>{});
      console.error('Envio incerto:',String(e?.message||e).slice(0,140));
      return;
    }
    const msgId=String(reply?.key?.id||'');
    if(!msgId) {
      await api({type:'ack',id:job.id,state:'uncertain',error:'WhatsApp não retornou identificador'}).catch(()=>{});
      return;
    }
    receiptJobs.set(msgId,job.id);
    await api({type:'ack',id:job.id,state:'accepted',messageId:msgId});
    await api({type:'message',phone:dest,text:job.body,messageId:msgId,fromMe:true});
    console.log('Mensagem aceita pelo dispositivo; entrega ainda não confirmada.');
  }catch(e){
    console.error('Fila indisponível:',String(e?.message||e).slice(0,140));
    if(job?.id)await api({type:'ack',id:job.id,state:'uncertain',error:'Erro após captura da fila. Verifique antes de repetir.'}).catch(()=>{});
  }finally{pollingBusy=false;}
}

async function connect(){
  clearTimeout(reconnectTimer);
  isReady=false;
  status='connecting';currentQr=null;
  await vault.restore();
  const {state,saveCreds}=await useMultiFileAuthState(join(folder,'session'));
  const keyWriter=state.keys.set.bind(state.keys);
  state.keys.set=async(...args)=>{
    const result=await keyWriter(...args);
    vault.schedule();
    return result;
  };
  const sock=makeWASocket({
    auth:state,browser:Browsers.ubuntu('LexisPredict'),
    markOnlineOnConnect:false,syncFullHistory:false,logger:pino({level:'silent'}),
  });
  socket=sock;
  sock.ev.on('creds.update',async()=>{
    try{await saveCreds();vault.schedule();}
    catch(e){console.error('Credenciais não persistidas:',e?.message||String(e));}
  });
  sock.ev.on('messages.upsert',({type,messages})=>{
    if(type!=='notify')return;
    for(const msg of messages||[])void onIncoming(msg);
  });
  sock.ev.on('messages.update',(updates)=>{
    for(const u of updates||[]){
      const id=String(u.key?.id||''),jobId=receiptJobs.get(id),ack=Number(u.update?.status);
      if(!jobId||!Number.isFinite(ack)||ack<3)continue;
      const next=ack>=4?'read':'delivered';
      void api({type:'ack',id:jobId,state:next,messageId:id})
        .then(()=>{if(next==='read')receiptJobs.delete(id);})
        .catch(e=>console.error('Recibo pendente:',e.message));
    }
  });
  sock.ev.on('connection.update',({connection,qr,lastDisconnect})=>{
    if(socket!==sock)return;
    if(qr){
      void QRCode.toDataURL(qr,{margin:2,width:300,errorCorrectionLevel:'M'})
        .then(img=>setStatus('qr',img))
        .catch(()=>setStatus('error',null,null,'Não foi possível gerar QR'));
    }
    if(connection==='open'){
      reconnectAttempts=0;
      const id=String(sock.user?.id||'');
      setStatus('ready',null,digits(id));
      setTimeout(()=>void prepareScheduledNotices(),6500);
    } else if(connection==='close'){
      isReady=false;
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code===DisconnectReason.loggedOut){
        setStatus('offline',null,null,'Sessão desvinculada. Preparando novo QR.');
        void vault.clear()
          .then(()=>setTimeout(()=>void connect().catch(e=>console.error('Novo QR:',e.message)),4000))
          .catch(e=>console.error('Não foi possível limpar a sessão antiga:',e.message));
        return;
      }
      setStatus('offline');
      reconnectAttempts++;
      const delay=Math.min(60000,5000*reconnectAttempts);
      reconnectTimer=setTimeout(()=>void connect().catch(e=>console.error('Reconexão:',e.message)),delay);
    }
  });
}
setInterval(()=>void heartbeat(),23000);
setInterval(()=>void poll(),15000);
setInterval(()=>void prepareScheduledNotices(),65000);
process.on('SIGINT',()=>{setStatus('offline');process.exit(0);});
process.on('SIGTERM',()=>{setStatus('offline');process.exit(0);});
console.log('LexisPredict WA.Auto servidor hospedado — aguarde vinculação.');
await connect();
