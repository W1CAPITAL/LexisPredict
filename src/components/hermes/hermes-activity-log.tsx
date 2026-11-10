'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,CheckCircle2,Clock3,AlertTriangle,Search,ExternalLink} from 'lucide-react';
import {hermesOfficeEventClock,type HermesOfficeEvent} from '@/lib/hermes-agent-route';

const SECTORS:Record<string,string>={
 processos:'Processos',provas:'Réplica e provas',operacao:'Retornos',
 comunicacoes:'Comunicação',relatorios:'Relatórios',agentes:'Supervisão de IA',
 crm:'Relacionamento',gestao:'Diretoria',
};
export function HermesActivityLog({events,selectedSector,onSelect}:{
 events:HermesOfficeEvent[];selectedSector:string;
 onSelect:(sector:string)=>void;
}){
 const [only,setOnly]=useState('todos');
 const [query,setQuery]=useState('');
 const shown=useMemo(()=>{
  const q=query.toLocaleLowerCase('pt-BR').trim();
  return events.filter(e=>(only==='todos'||e.sector===only)&&
    (!q||(e.title+' '+(e.detail||'')+' '+(SECTORS[e.sector]||'')).toLocaleLowerCase('pt-BR').includes(q)))
    .slice(0,32);
 },[events,only,query]);
 const recentCount=events.filter(e=>e.status==='working'&&Date.now()-Date.parse(e.recorded_at)<5*60*1000).length;
 return <section id="hermes-activity-log" className="h3d-panel-card p-4 sm:p-5" aria-label="Diário verificável de operações dos robôs">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <div>
      <h2 className="flex items-center gap-2 text-lg font-black text-white"><Activity size={19} className="text-[#e5b8cc]"/> Registro real de trabalho · passo a passo</h2>
      <p className="mt-1 text-xs leading-5 text-[#d7c4d0]">
       Histórico das consultas, rascunhos, relatórios e reuniões confirmadas pelo banco. Atualização automática sem rastreamento pesado.
      </p>
     </div>
     <span className="rounded-full border border-white/20 px-3 py-2 text-xs text-[#e7d9e0]">
      {recentCount?recentCount+' tarefa(s) recém-iniciada(s)':'Sem tarefa recente em execução confirmada'}
     </span>
   </div>
   <div className="mt-4 flex flex-wrap gap-2">
     <label className="inline-flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/20 bg-[#201824] px-3 text-[#ebdce4]">
       <Search size={14}/><input aria-label="Pesquisar atividades Hermes" placeholder="Filtrar atividade..." value={query}
        onChange={e=>setQuery(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-[#c4b3bf] outline-none" />
     </label>
     <select aria-label="Filtrar setor do log" value={only} onChange={e=>{setOnly(e.target.value);if(e.target.value!=='todos')onSelect(e.target.value)}}
       className="h-10 rounded-lg border border-white/20 bg-[#251b2b] px-3 text-xs text-white">
       <option value="todos">Todos os setores</option>
       {Object.entries(SECTORS).map(([id,label])=><option value={id} key={id}>{label}</option>)}
     </select>
   </div>
   <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1" aria-live="polite">
      {shown.map(event=>{
       const active=event.sector===selectedSector;
       const Icon=event.status==='working'?Clock3:event.status==='warning'?AlertTriangle:CheckCircle2;
       const label=event.status==='working'?'Iniciado':event.status==='warning'?'Atenção':'Concluído';
       return <article key={event.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3" data-hermes-event-id={event.id}>
         <span className={'mt-0.5 shrink-0 '+(event.status==='warning'?'text-amber-300':event.status==='working'?'text-[#c3cfff]':'text-emerald-300')}><Icon size={17}/></span>
         <div className="min-w-0 flex-1">
           <div className="flex flex-wrap items-center gap-2">
             <button type="button" onClick={()=>onSelect(event.sector)}
               className={'text-xs font-black underline decoration-white/25 underline-offset-2 hover:text-white '+(active?'text-[#f3bfd6]':'text-[#e6d6e0]')}>
               {SECTORS[event.sector]||event.sector}
             </button>
             <span className="text-[10px] text-[#d0bbc8]">{label}</span>
             <time className="ml-auto text-[11px] tabular-nums text-[#c7b7c1]" dateTime={event.recorded_at}>{hermesOfficeEventClock(event.recorded_at)}</time>
           </div>
           <p className="mt-1 text-sm font-bold leading-5 text-white">{event.title}</p>
           {event.detail&&<p className="mt-1 text-xs leading-5 text-[#d6c5d0]">{event.detail}</p>}
           {event.processo_id!=null&&<Link href="/processos" className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#e5bdd0] underline">
              Consultar processo na carteira <ExternalLink size={11}/>
           </Link>}
         </div>
       </article>;
      })}
      {!shown.length&&<p className="rounded-xl border border-white/10 bg-white/[.035] p-5 text-sm text-[#e3ceda]">
         {events.length?'Nenhuma atividade encontrada para este filtro.':'Nenhuma execução confirmada no histórico. Os robôs podem fazer uma ronda visual, mas isso não indica consultas realizadas.'}
       </p>}
   </div>
   <p className="mt-3 text-[11px] leading-5 text-[#c9b8c4]">Eventos guardados por 90 dias. O horário, a etapa e a origem são auditáveis; movimentar um robô não cria uma atividade. Não são enviados contatos nem feitas alterações em prazos por esta tela.</p>
 </section>;
}
