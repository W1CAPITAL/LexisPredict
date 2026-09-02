"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Database, Loader2, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";

const KEY = "lexis_hybrid_sync_checkpoint_v4";
const BATCH = 250;
const TIMEOUT = 18000;

type Health = { ok: boolean; sheetsWorking?: boolean; fallback?: string | null; total?: number; message?: string; webhookError?: string };
type Batch = { ok: boolean; fallback?: string; sheetsWorking?: boolean; recoverable?: boolean; total?: number; processed?: number; accepted?: number; nextCursor?: string | null; hasMore?: boolean; error?: string; message?: string };

const nf = (n:number) => new Intl.NumberFormat("pt-BR").format(Math.max(0,n));
function checkpoint(){ try { const x=localStorage.getItem(KEY); return x?JSON.parse(x):null; } catch { return null; } }
function save(x:any){ try{localStorage.setItem(KEY,JSON.stringify(x));}catch{} }
function clear(){ try{localStorage.removeItem(KEY);}catch{} }

export function HybridStatusPanel(){
  const [health,setHealth]=useState<Health|null>(null);
  const [running,setRunning]=useState(false);
  const [done,setDone]=useState(0);
  const [total,setTotal]=useState(0);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("Verificando Plano B...");
  const [started,setStarted]=useState<number|null>(null);
  const [elapsed,setElapsed]=useState(0);

  const refresh=useCallback(async()=>{
    try{ const r=await fetch("/api/hybrid/sync",{cache:"no-store"}); const d=await r.json(); setHealth(d); setMessage(d.message || (d.sheetsWorking?"Google Sheets disponível.":"Lexis operando pelo Supabase.")); setError(d.sheetsWorking?"":(d.webhookError||"")); }
    catch(e:any){ setHealth({ok:false,sheetsWorking:false,fallback:"supabase"}); setMessage("Plano B indisponível; o Lexis continua pelo Supabase."); setError(e?.message||"Falha ao verificar o Plano B."); }
  },[]);
  useEffect(()=>{void refresh(); const i=setInterval(()=>void refresh(),20000); return()=>clearInterval(i)},[refresh]);
  useEffect(()=>{if(started==null)return;const i=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(i)},[started]);

  const sync=useCallback(async(force:boolean)=>{
    if(running)return; setError(""); const cp=force?null:checkpoint(); let cursor=cp?.cursor??null; let n=cp?.processed??0; let t=cp?.total??0; const st=Date.now();
    setRunning(true);setStarted(st);setDone(n);setTotal(t);setMessage(force?"Refazendo seed...":"Sincronizando...");
    try{
      for(;;){
        const c=new AbortController(); const timer=setTimeout(()=>c.abort(),TIMEOUT);
        let r:Response; try{r=await fetch("/api/hybrid/sync",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:c.signal,body:JSON.stringify({action:"seed_batch",cursor,batchSize:BATCH})});}finally{clearTimeout(timer)}
        const d:Batch=await r.json();
        if(d.fallback==="supabase" || d.sheetsWorking===false){setMessage("Google Sheets indisponível — operação normal mantida pelo Supabase.");setError(d.error||"Plano B indisponível.");break;}
        if(!r.ok||!d.ok)throw new Error(d.error||`Falha HTTP ${r.status}`);
        t=Number(d.total??t); n+=Number(d.accepted??d.processed??0); cursor=d.nextCursor??null; setTotal(t);setDone(n);
        if(d.hasMore){save({cursor,processed:n,total:t,startedAt:st});setMessage(`Sincronizando ${nf(n)} / ${nf(t)} processos...`);continue;}
        clear();setDone(t||n);setMessage(`✓ Planilha sincronizada · ${nf(t||n)} processos`);await refresh();break;
      }
    }catch(e:any){setError(e?.name==="AbortError"?"O lote excedeu o tempo limite. O checkpoint foi preservado; o Lexis continua pelo Supabase.":e?.message||String(e));setMessage("Plano B interrompido — o Lexis continua pelo Supabase.");}
    finally{setRunning(false);setStarted(null)}
  },[refresh,running]);

  const p=total?Math.min(100,(done/total)*100):0;
  return <section className="rounded-2xl border border-border bg-card p-3 shadow-sm space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${health?.sheetsWorking?"bg-emerald-500":"bg-amber-500"}`}/><span className="text-xs font-black uppercase tracking-wide">Estado da sincronização</span></div><Button size="sm" variant="outline" disabled={running} onClick={()=>void refresh()}><RefreshCw className="h-4 w-4"/><span className="ml-1">Verificar</span></Button></div>
    <p className="text-[10px] font-semibold text-muted-foreground">{message}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl border px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Fonte</p><p className="text-xs font-black">Supabase</p></div><div className="rounded-xl border px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Plano B</p><p className="text-xs font-black flex items-center gap-1">{health?.sheetsWorking?<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600"/>:<TriangleAlert className="h-3.5 w-3.5 text-amber-500"/>}{health?.sheetsWorking?"Sheets OK":"fallback Supabase"}</p></div><div className="rounded-xl border px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Processos</p><p className="text-xs font-black">{health?.total!=null?nf(health.total):"—"}</p></div><div className="rounded-xl border px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Tempo</p><p className="text-xs font-black">{elapsed}s</p></div></div>
    {(running||done>0)&&<div className="rounded-xl border bg-muted/20 p-3 space-y-2"><div className="flex justify-between text-[10px] font-bold"><span>{nf(done)} / {nf(total||done)}</span><span>{total?`${p.toFixed(1)}%`:"calculando..."}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-[width]" style={{width:`${Math.max(p,running?3:0)}%`}}/></div><div className="text-[9px] text-muted-foreground">Lote: {BATCH} · checkpoint preservado em falha</div></div>}
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={running||!health?.sheetsWorking} onClick={()=>void sync(false)}>{running?<Loader2 className="h-4 w-4 animate-spin"/>:<Database className="h-4 w-4"/>}<span className="ml-1">Sincronizar agora</span></Button><Button size="sm" variant="outline" disabled={running||!health?.sheetsWorking} onClick={()=>void sync(true)}><RotateCcw className="h-4 w-4"/><span className="ml-1">Refazer seed</span></Button></div>
    {!health?.sheetsWorking&&<div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">Google Sheets indisponível. O Plano B fica parado e o Lexis continua normalmente pelo Supabase.</div>}
    {error&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
  </section>;
}
export default HybridStatusPanel;
