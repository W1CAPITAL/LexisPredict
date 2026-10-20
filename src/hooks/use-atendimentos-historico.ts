"use client";
import {useEffect,useState} from "react";
import {getAtendimentosHistoricoAction} from "@/app/actions/atendimentos-historico-actions";
import type {AtendimentosHistorico} from "@/lib/historico-atendimentos";
import type {PeriodoRelatorio} from "@/lib/atendimento-semana";

/** Cache apenas em memória, particionado por empresa e período. Nenhum usuário
 * recebe dados de outra empresa. Refresh sob foco, salvamento e a cada minuto. */
const cache=new Map<string,{at:number;data:AtendimentosHistorico}>();
const pending=new Map<string,Promise<Awaited<ReturnType<typeof getAtendimentosHistoricoAction>>>>();
const TTL=30_000;
export function useAtendimentosHistorico(periodo:PeriodoRelatorio="esta_semana",empresaId?:string|null){
 const key=empresaId?empresaId+":"+periodo:"";
 const [data,setData]=useState<AtendimentosHistorico|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!key){setData(null);setLoading(true);return;}
  let alive=true;
  const first=cache.get(key);
  setData(first?.data||null);
  setLoading(!first?.data);
  const refresh=(force=false)=>{
   if(!alive)return;
   const hit=cache.get(key);
   if(!force&&hit&&Date.now()-hit.at<TTL){setData(hit.data);setLoading(false);return;}
   let req=pending.get(key);
   if(!req){
    req=getAtendimentosHistoricoAction(periodo);
    pending.set(key,req);
    void req.finally(()=>{if(pending.get(key)===req)pending.delete(key);}).catch(()=>{});
   }
   void req.then(r=>{
    if(!alive)return;
    if(!r.ok){setError(r.error||"Falha ao ler atendimentos");setLoading(false);return;}
    cache.set(key,{at:Date.now(),data:r.data});setData(r.data);setError("");setLoading(false);
   }).catch(e=>{if(alive){setError(String(e));setLoading(false);}});
  };
  refresh();
  const onChanged=()=>refresh(true);
  const onFocus=()=>{if(!document.hidden)refresh(true);};
  window.addEventListener("lexis-carteira-updated",onChanged);
  window.addEventListener("focus",onFocus);
  const interval=window.setInterval(()=>{if(!document.hidden)refresh(true);},60_000);
  return()=>{alive=false;window.removeEventListener("lexis-carteira-updated",onChanged);window.removeEventListener("focus",onFocus);window.clearInterval(interval);};
 },[key,periodo]);
 return {data,loading,error,refresh:()=>{cache.delete(key);window.dispatchEvent(new Event("lexis-carteira-updated"));}};
}