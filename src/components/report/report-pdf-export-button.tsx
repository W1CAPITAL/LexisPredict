"use client";

import {useState} from "react";
import {AlertCircle,CheckCircle2,Download,LoaderCircle} from "lucide-react";

type Props={
  periodo:"esta_semana"|"semana_passada"|"mes"|string;
  escopo?:"empresa"|"meus";
  label?:string;
  className?:string;
  disabled?:boolean;
};

export function ReportPdfExportButton({
  periodo,
  escopo="empresa",
  label="Exportar PDF",
  className="",
  disabled=false,
}:Props){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);

  async function exportPdf(){
    if(loading||disabled)return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try{
      const params=new URLSearchParams({periodo,escopo});
      const response=await fetch("/api/report/pdf?"+params.toString(),{
        method:"GET",
        credentials:"same-origin",
        cache:"no-store",
        headers:{Accept:"application/pdf, application/json"},
      });
      const contentType=(response.headers.get("content-type")||"").toLowerCase();
      if(!response.ok||!contentType.includes("application/pdf")){
        let message="Não foi possível gerar o PDF.";
        try{
          const payload=await response.json() as {error?:string;message?:string};
          message=payload.error||payload.message||message;
        }catch{
          if(response.status===401||response.status===403)message="Sua sessão expirou ou não tem permissão. Entre novamente e tente exportar.";
          else message="Falha na exportação (HTTP "+response.status+").";
        }
        throw new Error(message);
      }
      const blob=await response.blob();
      if(blob.size<100)throw new Error("O servidor retornou um PDF vazio. Tente novamente.");
      const disposition=response.headers.get("content-disposition")||"";
      const match=disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const filename=match?.[1]
        ?decodeURIComponent(match[1].replace(/"/g,"").trim())
        :"LexisPredict-Relatorio-Gerencial-"+periodo+".pdf";
      const objectUrl=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=objectUrl;
      anchor.download=filename.toLowerCase().endsWith(".pdf")?filename:filename+".pdf";
      anchor.style.display="none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
      setSuccess(true);
    }catch(e){
      setError(e instanceof Error?e.message:"Erro inesperado ao gerar o PDF.");
    }finally{
      setLoading(false);
    }
  }

  return <div className="inline-flex min-w-0 flex-col items-start gap-1">
    <button
      type="button"
      onClick={exportPdf}
      disabled={loading||disabled}
      aria-busy={loading}
      className={className||"inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-500 bg-gradient-to-r from-blue-600 to-violet-700 px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"}
    >
      {loading?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}
      {loading?"Gerando PDF…":label}
    </button>
    {error?<p role="alert" className="flex max-w-[360px] items-start gap-1.5 text-[11px] leading-4 text-rose-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{error}</p>:null}
    {success&&!error?<p role="status" className="flex items-center gap-1 text-[11px] text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5"/>PDF gerado e enviado para download.</p>:null}
  </div>;
}
