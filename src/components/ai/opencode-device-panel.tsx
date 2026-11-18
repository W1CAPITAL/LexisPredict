"use client";
import {useState} from "react";
import {supabase} from "@/lib/supabase";
type Device={id:string;name:string;state:string;online?:boolean;scopes?:string[]};
type Job={id?:string;status?:string;result?:unknown};
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export default function OpenCodeDevicePanel({initialPrompt=""}:{initialPrompt?:string}){
 const [devices,setDevices]=useState<Device[]>([]);
 const [deviceId,setDeviceId]=useState("");
 const [prompt,setPrompt]=useState(initialPrompt);
 const [consent,setConsent]=useState(false);
 const [sessionId,setSessionId]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("Abra a Central de Apps e pareie o seu PC com autorização.");
 const [output,setOutput]=useState("");
 const call=async(body:Record<string,unknown>):Promise<any>=>{
  if(!supabase)throw Error("Conecte o Supabase do LexisPredict antes de continuar.");
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw Error("Entre novamente na sua conta LexisPredict.");
  const res=await fetch("/api/opencode/relay",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},cache:"no-store",body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(res.status===403?"Habilite o MCP, confirme MFA e autorize seu dispositivo.":String(data?.error||"Ponte OpenCode indisponível."));
  return data;
 };
 const completed=async(jobId:string):Promise<unknown>=>{
  for(let n=0;n<36;n++){
   await pause(2500);
   const job:Job=await call({action:"task",jobId});
   if(job.status==="succeeded")return job.result;
   if(["unknown","failed","cancelled"].includes(job.status||""))throw Error(job.status==="unknown"?"Resultado incerto. Verifique o OpenCode antes de tentar novamente.":"A operação foi recusada ou falhou no PC.");
  }
  throw Error("Tarefa ainda não confirmada. Confira a Central antes de reenviar.");
 };
 const execute=async(operation:string,input:Record<string,unknown>):Promise<any>=>{
  const started:Job=await call({action:"submit",deviceId,operation,input,key:crypto.randomUUID()});
  if(!started.id)throw Error("A ponte não confirmou o identificador da tarefa.");
  return completed(started.id);
 };
 const find=async()=>{
  setBusy(true);
  try{
   const data=await call({action:"devices"});
   const list:Device[]=Array.isArray(data)?data.filter((d:Device)=>d.state==="approved"&&d.online&&d.scopes?.includes("execute")):[];
   setDevices(list);setDeviceId(old=>list.some(d=>d.id===old)?old:list[0]?.id||"");
   setNotice(list.length?"Selecione seu computador e confirme o envio da tarefa.":"Nenhum PC autorizado e ativo. Abra a Central, conecte o OpenCode e pareie com MFA.");
  }catch(e){setNotice(e instanceof Error?e.message:"Falha ao procurar PC.");}
  finally{setBusy(false)}
 };
 const send=async()=>{
  if(!consent||!deviceId||!prompt.trim()){setNotice("Escolha o PC, escreva a tarefa e autorize o envio.");return;}
  setBusy(true);setOutput("");
  try{
   let id=sessionId;
   if(!id){
    setNotice("Aguardando sessão no OpenCode. Confirme no PC se solicitado.");
    const s=await execute("create",{title:"LexisPredict · Tarefa com revisão humana"});
    id=String(s?.id||s?.data?.id||"");
    if(!/^ses[a-zA-Z0-9_-]+$/.test(id))throw Error("Sessão não confirmada. Não reenvie até verificar no PC.");
    setSessionId(id);
   }
   setNotice("Enviando tarefa com autorização local...");
   const receipt=await execute("prompt",{sessionId:id,text:prompt.trim()});
   setOutput(JSON.stringify(receipt??{},null,2).slice(0,14000));
   setNotice("O OpenCode respondeu à chamada. Confira o resultado antes de aplicar alterações.");
  }catch(e){setNotice(e instanceof Error?e.message:"Falha na conexão.");}
  finally{setBusy(false)}
 };
 const readMessages=async()=>{
  if(!sessionId)return;
  setBusy(true);
  try{setNotice("Lendo respostas do computador...");const data=await execute("messages",{sessionId});setOutput(JSON.stringify(data??{},null,2).slice(0,18000));setNotice("Respostas recebidas.");}
  catch(e){setNotice(e instanceof Error?e.message:"Resposta não disponível.");}
  finally{setBusy(false)}
 };
 return <details className="my-3 rounded-xl border border-primary/40 bg-card/60 p-4 text-sm">
  <summary className="cursor-pointer font-bold">Executar com OpenCode no meu computador (MCP)</summary>
  <p className="mt-2 text-xs text-muted-foreground">Conecte o PC na Central W1 com MFA. O OpenCode usa o provedor e as permissões configurados nele. Nenhum documento ou processo é enviado automaticamente.</p>
  <div className="mt-3 flex flex-wrap items-center gap-2">
   <button type="button" onClick={find} disabled={busy} className="rounded-md border px-3 py-2">Procurar computador</button>
   <label className="text-xs">Meu PC <select className="ml-2 max-w-52 rounded-md border bg-background px-2 py-2" disabled={busy||!devices.length} value={deviceId} onChange={e=>{setDeviceId(e.target.value);setSessionId("")}}><option value="">Selecione</option>{devices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
  </div>
  <label className="mt-3 block text-xs font-semibold">Tarefa<textarea className="mt-2 block min-h-20 w-full rounded-lg border bg-background p-3 text-sm" maxLength={32000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Escreva o que precisa que o OpenCode realize."/></label>
  <label className="my-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Autorizo enviar esta tarefa ao OpenCode e ao modelo conectado ao meu computador.</label>
  <div className="flex flex-wrap gap-2">
   <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground" disabled={busy||!deviceId||!consent} onClick={send}>Enviar tarefa ao meu PC</button>
   <button type="button" className="rounded-md border px-3 py-2" disabled={busy||!sessionId} onClick={readMessages}>Ver respostas</button>
   <button type="button" className="rounded-md border px-3 py-2" disabled={busy} onClick={()=>{setSessionId("");setOutput("");setNotice("Uma nova sessão será criada na próxima tarefa.")}}>Nova sessão</button>
  </div>
  <p role="status" className="mt-3 text-xs text-muted-foreground">{busy?"Aguardando a ponte · ":""}{notice}</p>
  {output&&<pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-xs">{output}</pre>}
 </details>;
}
