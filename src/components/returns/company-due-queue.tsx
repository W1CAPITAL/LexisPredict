"use client";

import React from 'react';
import Link from 'next/link';
import {CalendarClock,CheckCircle2,Clock3,FileSearch,RefreshCw,Search,ShieldCheck,AlertTriangle} from 'lucide-react';
import {Sidebar} from '@/components/layout/sidebar';
import {HermesReturnReviewButton} from '@/components/hermes/hermes-return-review-button';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {NovoProcessoButton} from '@/components/cases/novo-processo-button';
import type {LegalCase} from '@/lib/case-logic';
import {listCompanyDueReturns} from '@/lib/company-return-queue';
import {loadAllDuePages} from '@/lib/today-due-consistency';
import {useAdmin} from '@/hooks/use-admin';

type Filter='all'|'overdue'|'today';
const todayBrazil=()=>new Intl.DateTimeFormat('sv-SE',{
 timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const showDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';

export function CompanyDueQueue(){
 const {profile}=useAdmin();
 const companyId=String((profile as {empresa_id?:string}|null)?.empresa_id||'');
 const [today,setToday]=React.useState(todayBrazil);
 const [refreshKey,refresh]=React.useReducer((value:number)=>value+1,0);
 const [cases,setCases]=React.useState<LegalCase[]|null>(null);
 const [busy,setBusy]=React.useState(false);
 const [error,setError]=React.useState('');
 const [query,setQuery]=React.useState('');
 const [filter,setFilter]=React.useState<Filter>('all');

 React.useEffect(()=>{
  if(!companyId){setCases(null);return;}
  const controller=new AbortController();
  setBusy(true);setError('');setCases(null);
  void loadAllDuePages<LegalCase>(async offset=>{
   const params=new URLSearchParams({field: 'proximo-retorno',to:today,offset:String(offset)});
   const response=await fetch('/api/carteira/filtered?'+params.toString(),{
    credentials:'same-origin',cache:'no-store',signal:controller.signal,
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok||payload?.ok!==true||!Array.isArray(payload.cases))
    throw new Error(payload?.error||'Não foi possível ler todos os retornos da empresa.');
   return {cases:payload.cases as LegalCase[],hasMore:payload.hasMore===true};
  },{maxCases:100000,signal:controller.signal})
   .then(all=>{if(!controller.signal.aborted)setCases(all);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'A consulta não foi concluída.');})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return ()=>controller.abort();
 },[companyId,today,refreshKey]);

 const due=React.useMemo(()=>listCompanyDueReturns(cases||[],today),[cases,today]);
 const overdue=due.filter(item=>item.kind==='overdue').length;
 const dueToday=due.length-overdue;
 const visible=React.useMemo(()=>{
  const q=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return due.filter(item=>{
   if(filter!=='all'&&item.kind!==filter)return false;
   if(!q)return true;
   return [item.process.cliente,item.process.protocolo,item.process.advogado,item.process.escritorio]
    .some(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));
  });
 },[due,filter,query]);

 return <div className="flex min-h-screen bg-background text-foreground">
  <Sidebar/>
  <main className="min-w-0 flex-1 px-3 pb-24 pt-5 sm:px-6 lg:px-9">
   <div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-2xl border border-[#945a70]/25 bg-gradient-to-br from-[#421d34] via-[#6b3351] to-[#2f1728] p-5 text-white shadow-lg sm:p-7">
     <p className="text-xs font-bold uppercase tracking-[.16em] text-[#f4dce5]">LexisPredict · Operação da empresa</p>
     <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Fila de retornos prioritários</h1>
       <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#f4e8ee]">
        Todos os processos da empresa com retorno vencido válido ou previsto para hoje.
        Datas inconsistentes, processos encerrados e retornos futuros não entram nesta fila.
       </p></div>
      <div className="flex flex-wrap items-center gap-2">
       <NovoProcessoButton
        onCreated={()=>{setToday(todayBrazil());refresh();}}
        className="h-10 border border-white/35 bg-white/12 text-white shadow-none hover:bg-white/20"
       />
       <Button className="gap-2 bg-white text-[#4f2541] hover:bg-[#f3e6ed]" disabled={busy}
        onClick={()=>{setToday(todayBrazil());refresh();}}>
        <RefreshCw size={16} className={busy?'animate-spin':''}/> Atualizar fila
       </Button>
      </div>
     </div>
     <p className="mt-4 text-xs font-semibold text-[#f0dce6]">Referência: {showDate(today)} · horário de Brasília</p>
    </header>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
     <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle size={15}/> Retornos vencidos</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{cases?overdue:'—'}</p>
     </div>
     <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock size={15}/> Retornos de hoje</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{cases?dueToday:'—'}</p>
     </div>
     <div className="col-span-2 rounded-xl border border-border bg-card p-4 md:col-span-1">
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15}/> Prioridades para atender</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{cases?due.length:'—'}</p>
     </div>
    </div>

    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold">Processos que exigem retorno</h2>
       <p className="text-xs text-muted-foreground">A ordenação considera a gravidade operacional e o atraso real do retorno, sem inventar prazos judiciais.</p></div>
      <label className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-background px-3">
       <Search size={16} className="shrink-0 text-muted-foreground"/>
       <Input aria-label="Buscar processos da fila" value={query} onChange={event=>setQuery(event.target.value)}
        placeholder="Cliente, CNJ, advogado..." className="border-0 shadow-none focus-visible:ring-0"/>
      </label>
     </div>
     <div className="flex flex-wrap gap-2">
      {([{id:'all',label:'Todos'},{id:'overdue',label:'Vencidos'},{id:'today',label:'É hoje'}] as const).map(tab=>
       <Button key={tab.id} variant={filter===tab.id?'default':'outline'} size="sm" onClick={()=>setFilter(tab.id)}
        className={filter===tab.id?'bg-[#70334f] text-white hover:bg-[#5e2943]':''}>{tab.label}</Button>
      )}
     </div>
     {error?<p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">{error}</p>:null}
     {!error&&busy?<p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><RefreshCw size={16} className="animate-spin"/> Carregando a carteira empresarial completa…</p>:null}
     {!error&&!busy&&!companyId?<p className="p-5 text-sm text-muted-foreground">Carregando empresa autorizada…</p>:null}
     {!error&&!busy&&cases&&visible.length===0?<div className="rounded-xl border border-dashed border-border p-8 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700 dark:text-emerald-300"/>
      <p className="mt-3 font-bold">{query||filter!=='all'?'Nenhum processo neste filtro.':'Nenhum retorno vencido ou previsto para hoje.'}</p>
      <p className="mt-1 text-sm text-muted-foreground">Processos parados são monitorados separadamente pelo Hermes e não viram retornos vencidos sem data válida.</p>
     </div>:null}
     {!busy&&!error&&visible.length>0?<div className="grid gap-3">
      {visible.map(({process,dueOn,lastContact,daysLate,kind,priorityLabel,priorityScore})=>{
       const id=Number(process.db_id||process.id);
       const href='/processos?search='+encodeURIComponent(process.protocolo||String(process.id));
       return <article key={String(process.db_id||process.id)} className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
         <div className="min-w-0">
          <p className="text-xs font-bold text-[#814461] dark:text-[#e5b6cb]">{kind==='today'?'RETORNO HOJE':`RETORNO ATRASADO · ${daysLate} dia(s)`}</p>
          <h3 className="mt-1 text-base font-black">{process.cliente||'Cliente não identificado'}</h3>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{process.protocolo||'CNJ não cadastrado'}</p>
          <p className="mt-2 text-xs text-muted-foreground">Último atendimento: {showDate(lastContact)} · Próximo retorno: {showDate(dueOn)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{process.advogado||'Sem advogado'} · {process.escritorio||'Sem escritório'}</p>
         </div>
         <span className="rounded-full border border-[#814461]/30 bg-[#814461]/10 px-3 py-1 text-xs font-bold text-[#814461] dark:text-[#eec8d9]">Prioridade {priorityScore} · {priorityLabel}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
         <Link href={href} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted">
          <FileSearch size={15}/> Abrir processo e registrar atendimento
         </Link>
         {Number.isSafeInteger(id)&&id>0?<HermesReturnReviewButton compact processId={id}/>:null}
        </div>
       </article>;
      })}
     </div>:null}
    </section>
    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
     <Clock3 className="mt-0.5 shrink-0" size={15}/> A consulta automática Hermes não registra atendimento, não altera a data do próximo retorno e não envia mensagens aos clientes.
    </p>
   </div>
  </main>
 </div>;
}
