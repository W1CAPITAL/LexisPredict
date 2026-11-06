"use client";

import * as React from "react";
import {gerarPecaTextoPDFAction} from "@/app/actions/document-actions";

type Status={ok:boolean;configured?:boolean;error?:string};
type UploadReply={ok:boolean;documentId?:string;status?:string;error?:string};

/**
 * Ação opcional no editor de documentos já existente.
 * Prepara um PDF em conta Assinafy autorizada; não dispara convites de assinatura.
 */
export function AssinafyPrepareDocument({texto,titulo,sub}:{texto:string;titulo:string;sub:string}){
 const [configured,setConfigured]=React.useState<boolean|null>(null);
 const [busy,setBusy]=React.useState(false);
 const requestInFlight=React.useRef(false);
 const [confirmed,setConfirmed]=React.useState(false);
 const [result,setResult]=React.useState<{id:string;status:string}|null>(null);
 const [message,setMessage]=React.useState("");
 React.useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/integracoes/assinafy",{credentials:"same-origin",cache:"no-store",signal:controller.signal})
   .then(async response=>{const data=await response.json() as Status;if(!response.ok)throw Error(data.error||"Conexão indisponível.");return data;})
   .then(data=>{if(!controller.signal.aborted)setConfigured(data.configured===true);})
   .catch(()=>{if(!controller.signal.aborted)setConfigured(false);});
  return ()=>controller.abort();
 },[]);
 React.useEffect(()=>{setResult(null);setConfirmed(false);setMessage("");},[texto,titulo,sub]);

 async function prepare(){
  if(requestInFlight.current||busy||!confirmed||!texto.trim()||!configured)return;
  requestInFlight.current=true;
  setBusy(true);setMessage("");setResult(null);
  try{
   const generated=await gerarPecaTextoPDFAction({texto:texto.trim(),titulo,sub});
   if(!generated.success||!generated.base64)throw Error(generated.error||"Não foi possível gerar o PDF.");
   const data=Uint8Array.from(atob(generated.base64),(char)=>char.charCodeAt(0));
   const payload=new FormData();
   const safeName=titulo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,80)||"documento";
   payload.append("pdf",new File([data],safeName+".pdf",{type:"application/pdf"}));
   payload.append("confirmed","true");
   const response=await fetch("/api/integracoes/assinafy",{method:"POST",credentials:"same-origin",body:payload,cache:"no-store"});
   const reply=await response.json() as UploadReply;
   if(!response.ok||!reply.ok||!reply.documentId)throw Error(reply.error||"A Assinafy não confirmou o recebimento.");
   setResult({id:reply.documentId,status:reply.status||"uploaded"});
   setConfirmed(false);
  }catch(e){
   setMessage(e instanceof Error?e.message:"Erro no preparo da assinatura.");
  }finally{requestInFlight.current=false;setBusy(false);}
 }
 return <details className="rounded-none border border-[#b89b5e]/70 bg-[#fffaf0] p-4 text-xs">
  <summary className="cursor-pointer font-bold text-[#6f1d2b]">Assinatura eletrônica · preparar na Assinafy</summary>
  <div className="mt-3 space-y-3">
   <p className="text-[#655b52]">Usa o PDF da minuta revisada nesta tela. O preparo salva o documento no workspace Assinafy vinculado ao escritório, mas não envia convite ou notificação automaticamente. O preparo pode consumir cota do plano Assinafy.</p>
   {configured===null?<p role="status">Verificando conexão…</p>:
    !configured?<p role="status" className="text-amber-800">Assinafy não conectada à conta autorizada do escritório. O PDF continua disponível para exportação; nenhum arquivo foi enviado.</p>:
    <label className="flex items-start gap-2 text-[#493b34]">
     <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-0.5" disabled={busy}/>
     <span>Revisei o PDF e autorizo explicitamente enviar uma cópia à conta Assinafy do escritório para preparação de assinatura. Entendo que isso ainda não notifica signatários e pode consumir cota do plano Assinafy.</span>
    </label>}
   {configured&&<button type="button" disabled={busy||!confirmed||!texto.trim()} onClick={()=>void prepare()} className="rounded-md bg-[#6f1d2b] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">
    {busy?"Preparando documento…":"Preparar PDF na Assinafy"}
   </button>}
   {message&&<p role="alert" className="text-amber-800">{message}</p>}
   {result&&<div role="status" className="rounded border border-emerald-400/50 bg-emerald-50 p-3 text-emerald-900">
    <p className="font-semibold">Documento recebido pela Assinafy.</p>
    <p>ID: <code className="break-all">{result.id}</code> · Status: {result.status}</p>
    <p>Convites não enviados. Revise signatários, método e possíveis custos no painel Assinafy.</p>
    <a href="https://app.assinafy.com.br/" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline">Abrir minha conta Assinafy</a>
   </div>}
  </div>
 </details>;
}
