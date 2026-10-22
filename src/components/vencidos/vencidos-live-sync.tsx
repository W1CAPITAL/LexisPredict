"use client";
import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {RefreshCw} from "lucide-react";

/** Apenas atualiza os dados RSC, não recarrega o documento do navegador.
 * Outras abas comunicam alterações pelo token de invalidação da carteira.
 * Atualização periódica é lenta e só roda quando a central está visível.
 */
export function VencidosLiveSync(){
 const router=useRouter();
 const [refreshing,startTransition]=useTransition();
 const [last,setLast]=useState("");
 const refreshedAt=useRef(0);
 const initialized=useRef(false);
 const request=()=>{
  if(document.hidden||Date.now()-refreshedAt.current<2500)return;
  refreshedAt.current=Date.now();
  startTransition(()=>{router.refresh();setLast(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));});
 };
 useEffect(()=>{
  const updated=()=>request();
  const onStorage=(ev:StorageEvent)=>{
   if(ev.key==="lexis_carteira_invalidation_v1"||ev.key==="lexis_carteira_refresh_at")updated();
  };
  const onFocus=()=>{if(Date.now()-refreshedAt.current>45000)updated();};
  const onVisible=()=>{if(!document.hidden&&Date.now()-refreshedAt.current>45000)updated();};
  // Revalidar no primeiro acesso também evita mostrar payload prefetched desatualizado.
  if(!initialized.current){initialized.current=true;updated();}
  window.addEventListener("lexis-carteira-updated",updated);
  window.addEventListener("storage",onStorage);
  window.addEventListener("focus",onFocus);
  document.addEventListener("visibilitychange",onVisible);
  const interval=window.setInterval(()=>{if(!document.hidden&&Date.now()-refreshedAt.current>90000)updated();},90000);
  return ()=>{
   window.removeEventListener("lexis-carteira-updated",updated);
   window.removeEventListener("storage",onStorage);
   window.removeEventListener("focus",onFocus);
   document.removeEventListener("visibilitychange",onVisible);
   window.clearInterval(interval);
  };
 },[router]);
 return <button type="button" disabled={refreshing} onClick={request} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-60" title="Consultar novamente o Supabase sem recarregar a aba">
  <RefreshCw className={"h-4 w-4 "+(refreshing?"animate-spin":"")}/>{refreshing?"Atualizando dados…":"Atualizar vencidos"}{last?<span className="font-normal text-muted-foreground">· {last}</span>:null}
 </button>;
}
