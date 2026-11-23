"use client";

import React,{useEffect,useState} from "react";
import {useParams} from "next/navigation";

type FormField={key:string;label:string;type:"text"|"email"|"phone"|"textarea";required:boolean};
type FormDataView={ok:boolean;title:string;fields:FormField[];expiresAt:string;error?:string};
const fieldClass="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-800";
export default function PublicIntakePage(){
 const {token}=useParams<{token:string}>();
 const [form,setForm]=useState<FormDataView|null>(null);
 const [loading,setLoading]=useState(true);
 const [values,setValues]=useState<Record<string,string>>({});
 const [files,setFiles]=useState<File[]>([]);
 const [consent,setConsent]=useState(false);
 const [sending,setSending]=useState(false);
 const [sent,setSent]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  if(!token)return;
  const controller=new AbortController();
  fetch("/api/public/intake/"+encodeURIComponent(token),{signal:controller.signal,cache:"no-store"})
   .then(r=>r.json()).then(setForm).catch(()=>setForm({ok:false,error:"Não foi possível abrir o formulário.",title:"",fields:[],expiresAt:""}))
   .finally(()=>setLoading(false));
  return ()=>controller.abort();
 },[token]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!form?.ok||sending)return;
  setMessage("");setSending(true);
  try{
   const body=new FormData();
   body.set("answers",JSON.stringify(values));
   body.set("consent",consent?"yes":"no");
   body.set("website","");
   files.forEach(f=>body.append("files",f));
   const response=await fetch("/api/public/intake/"+encodeURIComponent(token),{method:"POST",body});
   const result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||"Falha ao registrar.");
   setSent(true);
   setMessage(result.warnings?.length?"Resposta registrada. "+result.warnings.join(" "):"Resposta registrada com sucesso.");
  }catch(err:any){setMessage(err?.message||"Falha ao registrar a resposta.");}
  finally{setSending(false);}
 };
 return <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
  <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <header className="bg-gradient-to-r from-[#59192e] to-[#78263e] p-7 text-white">
    <p className="text-xs font-semibold uppercase tracking-widest text-white/75">LexisPredict · Entrada protegida</p>
    <h1 className="mt-2 text-2xl font-bold">{form?.ok?form.title:"Formulário de documentos"}</h1>
    <p className="mt-2 text-sm text-white/80">Os dados são recebidos para análise do atendimento. O envio não cria processo nem garante resposta automática.</p>
   </header>
   <div className="space-y-5 p-6">
    {loading?<p>Carregando formulário...</p>:!form?.ok?
     <p role="alert" className="text-red-700">{form?.error||"Formulário indisponível."}</p>:
     sent?<p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{message}</p>:
     <form onSubmit={submit} className="space-y-5">
      {form.fields.map(field=><label key={field.key} className="block space-y-1.5">
       <span className="block text-sm font-semibold">{field.label}{field.required?" *":""}</span>
       {field.type==="textarea"?
        <textarea className={fieldClass+" min-h-28"} value={values[field.key]||""} required={field.required}
         maxLength={3000} onChange={e=>setValues(prev=>({...prev,[field.key]:e.target.value}))}/>:
        <input className={fieldClass} type={field.type==="email"?"email":field.type==="phone"?"tel":"text"}
         maxLength={240} value={values[field.key]||""} required={field.required}
         onChange={e=>setValues(prev=>({...prev,[field.key]:e.target.value}))}/>}
      </label>)}
      <label className="block space-y-1.5">
       <span className="text-sm font-semibold">Documentos anexos (opcional · até 2 arquivos, 4 MB cada)</span>
       <input className={fieldClass} type="file" accept="application/pdf,image/jpeg,image/png" multiple
        onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,2))}/>
      </label>
      <label className="flex items-start gap-3 text-sm">
       <input type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>
       <span>Autorizo o tratamento dos dados e documentos enviados para análise deste atendimento. Estou ciente de que a solicitação será revisada por uma pessoa.</span>
      </label>
      {message?<p role="alert" className="text-red-700">{message}</p>:null}
      <button type="submit" disabled={!consent||sending}
       className="rounded-lg bg-[#63233a] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
       {sending?"Registrando...":"Enviar informações"}
      </button>
     </form>}
   </div>
  </section>
 </main>;
}
