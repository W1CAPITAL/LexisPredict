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
import {reconnectDelay,createInboundDeduper,createEarlyReceiptBuffer} from './connection-lifecycle.mjs';

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
let qrIssuedAt=null;
let phone=null;
let lastRefreshRequest='';
let qrRestartBusy=false;
let lastQrRestartAt=0;
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
let connectPromise=null;
const receiptJobs=new Map();
const earlyReceipts=createEarlyReceiptBuffer();
const inboundDeduper=createInboundDeduper();
const sendInterval=2000;
let lastSend=0;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** One transport connection at a time, with bounded jittered retries.
 * No reconnect path re-queues a claimed send automatically.
 */
function scheduleReconnect(delayOverride){
  if(reconnectTimer)return;
  reconnectAttempts++;
  const delay=delayOverride??reconnectDelay(reconnectAttempts);
  console.log('Próxima tentativa de conexão em',Math.round(delay/1000),'s.');
  reconnectTimer=setTimeout(()=>{
    reconnectTimer=null;
    void connect().catch(e=>{
      console.error('Reconexão:',String(e?.message||e).slice(0,140));
      setStatus('error',null,null,'Falha ao iniciar conexão; nova tentativa programada.');
      scheduleReconnect();
    });
  },delay);
}
function pruneReceiptJobs(){
  const cutoff=Date.now()-2*60*60*1000;
  for(const [id,entry] of receiptJobs){
    if(entry.seenAt<=cutoff)receiptJobs.delete(id);
  }
  while(receiptJobs.size>2000)receiptJobs.delete(receiptJobs.keys().next().value);
}
async function flushReceipt(id){
  const entry=receiptJobs.get(id);
  if(!entry||!entry.accepted||entry.flushing)return;
  entry.flushing=true;
  try{
    while(receiptJobs.get(id)===entry){
      const target=entry.highestAck>=4?4:entry.highestAck>=3?3:0;
      if(target<=entry.reportedAck)break;
      await api({type:'ack',id:entry.jobId,state:target>=4?'read':'delivered',messageId:id});
      entry.reportedAck=target;
      if(target>=4){receiptJobs.delete(id);break;}
    }
  }catch(e){
    console.error('Recibo pendente de confirmação:',String(e?.message||e).slice(0,140));
    // Never mark a failed acknowledgement as delivered.
  }finally{entry.flushing=false;}
}
async function heartbeat(){
  if(heartbeatBusy)return;
  heartbeatBusy=true;
  try {
    const response=await api({type:'status',state:status,qr:currentQr,qrIssuedAt,phone});
    if(response.refreshQrRequestedAt)void requestFreshQr(response.refreshQrRequestedAt);
    // Reconcile delivery receipts after transient API outages; never
    // resend the original WhatsApp message.
    for(const [id,entry] of receiptJobs){
      if(entry.accepted&&entry.highestAck>entry.reportedAck)void flushReceipt(id);
    }
  }
  catch(e){console.error('Não foi possível atualizar o painel:',e.message);}
  finally{heartbeatBusy=false;}
}
function setStatus(next,qr=null,p=null,err=null){
  status=next;isReady=next==='ready';currentQr=qr;phone=p;
  qrIssuedAt=next==='qr'?new Date().toISOString():null;
  console.log('WhatsApp:',next,err?String(err).slice(0,100):'');
  void api({type:'status',state:next,qr,qrIssuedAt,phone:p,error:err||null})
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
  if(message.key?.fromMe===true)return; // Only inbound messages can set opt-out.
  const jid=String(message.key?.remoteJid||'');
  if(!jid.endsWith('@s.whatsapp.net'))return; // Never forward groups or status broadcasts.
  const number=digits(jid),content=textOf(message),messageId=String(message.key?.id||'');
  if(!number||!content||!messageId)return;
  const key=number+':'+messageId;
  if(!inboundDeduper.claim(key))return;
  try{await api({type:'message',phone:number,text:content,messageId,fromMe:false});}
  catch(e){
    inboundDeduper.release(key); // A re-delivery may safely retry the opt-out.
    console.error('Preferência do contato não sincronizada:',String(e?.message||e).slice(0,140));
  }
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
    // Pin a single ready socket. A claimed job is never automatically
    // sent twice after an ambiguous disconnect or socket replacement.
    const activeSocket=socket;
    await sleep(Math.max(0,sendInterval-(Date.now()-lastSend)));
    if(!isReady||!activeSocket||socket!==activeSocket)
      throw Error('A sessão desconectou antes do envio; confirmar manualmente a fila.');
    lastSend=Date.now();
    let reply;
    try{reply=await activeSocket.sendMessage(dest+'@s.whatsapp.net',{text:job.body});}
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
    pruneReceiptJobs();
    const entry={jobId:job.id,accepted:false,highestAck:earlyReceipts.take(msgId),
      reportedAck:0,flushing:false,seenAt:Date.now()};
    receiptJobs.set(msgId,entry);
    await api({type:'ack',id:job.id,state:'accepted',messageId:msgId});
    entry.accepted=true;
    void flushReceipt(msgId);
    // Outgoing message contents are not stored by the bridge.
    console.log('Mensagem aceita pelo dispositivo; entrega ainda não confirmada.');
  }catch(e){
    console.error('Fila indisponível:',String(e?.message||e).slice(0,140));
    if(job?.id)await api({type:'ack',id:job.id,state:'uncertain',error:'Erro após captura da fila. Verifique antes de repetir.'}).catch(()=>{});
  }finally{pollingBusy=false;}
}

async function requestFreshQr(requestedAt){
  const when=Date.parse(String(requestedAt||''));
  if(!Number.isFinite(when)||!requestedAt||requestedAt===lastRefreshRequest||
      isReady||qrRestartBusy||Date.now()-lastQrRestartAt<30000)return;
  lastRefreshRequest=requestedAt;
  qrRestartBusy=true;lastQrRestartAt=Date.now();
  try{
    await api({type:'qr_refresh_ack',requestedAt});
    const previous=socket;
    socket=null; // Suppress late QR and close callbacks from the retired socket.
    try{previous?.end?.(new Error('QR refresh requested'));}catch{}
    setStatus('connecting'); // Do NOT clear existing credential backup.
    await connect();
  }catch(error){
    console.error('Falha ao renovar QR:',String(error?.message||error).slice(0,160));
    if(!socket){
      setStatus('error',null,null,'Não foi possível renovar o QR.');
      scheduleReconnect();
    }
  }finally{qrRestartBusy=false;}
}
async function connectOnce(){
  clearTimeout(reconnectTimer);
  reconnectTimer=null;
  isReady=false;
  const retired=socket;
  socket=null; // Late events from a previous generation cannot affect state.
  try{retired?.end?.(new Error('New connection generation'));}catch{}
  setStatus('connecting');
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
    if(socket!==sock)return;
    try{await saveCreds();vault.schedule();}
    catch(e){console.error('Credenciais não persistidas:',e?.message||String(e));}
  });
  sock.ev.on('messages.upsert',({type,messages})=>{
    if(socket!==sock||type!=='notify')return;
    for(const msg of messages||[])void onIncoming(msg);
  });
  sock.ev.on('messages.update',(updates)=>{
    if(socket!==sock)return;
    for(const u of updates||[]){
      const id=String(u.key?.id||''),ack=Number(u.update?.status);
      if(!id||!Number.isFinite(ack)||ack<3)continue;
      const entry=receiptJobs.get(id);
      if(!entry){earlyReceipts.observe(id,ack);continue;}
      entry.highestAck=Math.max(entry.highestAck,ack);
      entry.seenAt=Date.now();
      void flushReceipt(id);
    }
  });
  sock.ev.on('connection.update',({connection,qr,lastDisconnect})=>{
    if(socket!==sock)return;
    if(qr){
      void QRCode.toDataURL(qr,{margin:2,width:300,errorCorrectionLevel:'M'})
        .then(img=>{if(socket===sock&&!isReady)setStatus('qr',img);})
        .catch(()=>{if(socket===sock&&!isReady)setStatus('error',null,null,'Não foi possível gerar QR');});
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
        reconnectAttempts=0;
        void vault.clear()
          .then(()=>scheduleReconnect(4000))
          .catch(e=>{
            console.error('Não foi possível limpar a sessão antiga:',String(e?.message||e).slice(0,140));
            setStatus('error',null,null,'Limpeza da sessão falhou; intervenção necessária.');
          });
        return;
      }
      const reason=Number.isFinite(Number(code))
        ?'WhatsApp fechou a conexão: código '+code
        :'WhatsApp encerrou a tentativa de pareamento.';
      setStatus('offline',null,null,reason);
      console.error('WA.Auto desconectado:',reason);
      scheduleReconnect();
    }
  });
}
/** Single-flight connection initialization, including QR-refresh requests. */
async function connect(){
  if(connectPromise)return connectPromise;
  connectPromise=connectOnce();
  try{return await connectPromise;}
  finally{connectPromise=null;}
}
setInterval(()=>void heartbeat(),23000);
setInterval(()=>void poll(),15000);
setInterval(()=>void prepareScheduledNotices(),65000);
process.on('SIGINT',()=>{setStatus('offline');process.exit(0);});
process.on('SIGTERM',()=>{setStatus('offline');process.exit(0);});
console.log('LexisPredict WA.Auto servidor hospedado — aguarde vinculação.');
try{await connect();}
catch(e){
  console.error('Inicialização do WhatsApp:',String(e?.message||e).slice(0,140));
  setStatus('error',null,null,'Falha inicial de conexão; tentando novamente.');
  scheduleReconnect();
}
