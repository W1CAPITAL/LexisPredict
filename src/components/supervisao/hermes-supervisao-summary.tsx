"use client";

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Bot,AlertTriangle,FileSearch,RefreshCw,Users} from 'lucide-react';
import type {HermesOfficeDailyRow} from '@/lib/hermes-company-service';
import type {HermesOfficeIntelligence,HermesCaseHealth} from '@/lib/hermes-company-intelligence';
import type {HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';
import {HermesPortfolioReport} from '@/components/report/hermes-portfolio-report';

type Summary={
 record:HermesOfficeDailyRow|null;
 intelligence:HermesOfficeIntelligence|null;
 cases:HermesCaseHealth[];
 diagnostics:HermesPortfolioDiagnostics|null;
};

/** Carrega sob demanda, sem fazer a consulta longa da /supervisao esperar a IA. */
export function HermesSupervisaoSummary(){
 const section=useRef<HTMLElement|null>(null);
 const [data,setData]=useState<Summary|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const controller=useRef<AbortController|null>(null);
 const once=useRef(false);

 async function refresh(){
   if(controller.current)controller.current.abort();
   const next=new AbortController();
   controller.current=next;
   setLoading(true);setError('');
   try{
     const response=await fetch('/api/hermes-office',{credentials:'same-origin',cache:'no-store',signal:next.signal});
     const json=await response.json();
     if(!response.ok||!json.ok)throw Error(json.error||'Não foi possível consultar o Hermes.');
     if(!next.signal.aborted)setData({
       record:json.record||null,intelligence:json.intelligence||null,
       cases:Array.isArray(json.cases)?json.cases:[],
       diagnostics:json.diagnostics||null,
     });
   }catch(e){
     if(!next.signal.aborted)setError(e instanceof Error?e.message:'Relatório indisponível');
   }finally{if(!next.signal.aborted)setLoading(false);}
 }
 useEffect(()=>{
   const start=()=>{if(once.current)return;once.current=true;void refresh();};
   const el=section.current;
   if(!el || !('IntersectionObserver' in window)){start();return()=>controller.current?.abort();}
   const watcher=new IntersectionObserver(items=>{
     if(items.some(e=>e.isIntersecting)){start();watcher.disconnect();}
   },{rootMargin:'180px'});
   watcher.observe(el);
   return()=>{watcher.disconnect();controller.current?.abort();};
 },[]);

 const office=data?.intelligence,record=data?.record;
 return <section ref={section} id="supervisao-hermes" className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><Bot className="h-5 w-5 text-primary"/> Hermes · Supervisão dos agentes</h2>
      <p className="mt-1 text-xs text-muted-foreground">Registros oficiais consolidados, atas e problemas por setor. Consultado somente ao abrir esta seção.</p>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={()=>void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-60">
        <RefreshCw size={14} className={loading?'animate-spin':''}/> Atualizar
      </button>
      <Link href="/hermes-3d" className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Escritório 3D</Link>
    </div>
   </div>
   {loading&&!data?<p role="status" className="mt-3 text-xs text-muted-foreground" data-loading-swarm>Consultando resumo do Hermes…</p>:null}
   {error?<p role="alert" className="mt-3 text-xs text-amber-700 dark:text-amber-300">{error}{data?' · Exibindo o último resumo consultado.':''}</p>:null}
   {!loading&&!office&&!error?<p className="mt-3 text-sm text-muted-foreground">Nenhum resumo Hermes disponível nesta empresa. O servidor prepara a primeira consolidação.</p>:null}
   {data?.diagnostics&&<div className="mt-4"><HermesPortfolioReport data={data.diagnostics} compact/></div>}
   {office&&record?<div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
         {label:'Retornos vencidos',value:office.counters.overdue},
         {label:'Fontes a conferir',value:office.counters.staleSources},
         {label:'Atividades em 30 dias',value:office.counters.completedActivities30d},
         {label:'Revisões prontas',value:office.counters.readyReviews},
        ].map(item=><div key={item.label} className="rounded-xl border border-border bg-muted/20 px-3 py-2">
          <strong className="text-lg font-black tabular-nums text-foreground">{item.value.toLocaleString('pt-BR')}</strong>
          <p className="text-[11px] text-muted-foreground">{item.label}</p>
        </div>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <h3 className="flex items-center gap-2 text-xs font-extrabold"><Users size={15} className="text-primary"/> Ata da reunião · {record.day.split('-').reverse().join('/')}</h3>
          <p className="mt-2 text-xs leading-5 text-foreground">{record.meeting_note
            ?record.meeting_note:record.meeting_status==='pending'
              ?'Reunião do Superagente ainda não consolidada.':office.meeting.slice(0,2).map(x=>x.speaker+': '+x.text).join(' ')}</p>
          {record.meeting_status==='unavailable'?<p className="mt-1 text-[11px] text-muted-foreground">Resumo gerado por regras; a IA não respondeu.</p>:null}
          <p className="mt-1 text-[11px] text-muted-foreground">Saúde operacional: {office.health}. Não representa prognóstico judicial.</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <h3 className="flex items-center gap-2 text-xs font-extrabold"><AlertTriangle size={15} className="text-amber-600"/> Pendências verificáveis</h3>
          <div className="mt-2 space-y-2">
            {office.risks.slice(0,3).map(r=><p key={r.id} className="text-xs leading-5"><strong>{r.label}:</strong> {r.detail}</p>)}
          </div>
        </div>
      </div>
      {data.cases.length?<details className="rounded-xl border border-border p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground"><FileSearch size={15}/> Processos sinalizados · {data.cases.length} revisões recentes</summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.cases.slice(0,6).map(c=><Link key={c.processId} href={c.cnj?'/processos?search='+encodeURIComponent(c.cnj):'/processos'} className="rounded-lg border border-border bg-muted/20 p-2 text-xs hover:bg-muted">
            <span className="font-semibold">{c.client}</span><span className="ml-2 text-muted-foreground">{c.level}</span>
            <p className="mt-1 text-muted-foreground">{c.sourceStatus}</p>
          </Link>)}
        </div>
      </details>:null}
      <p className="text-[11px] text-muted-foreground">Os mesmos indicadores e achados entram no relatório executivo e no PDF da empresa. Dados da equipe não aparecem no PDF individual.</p>
   </div>:null}
 </section>;
}
