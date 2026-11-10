'use client';
import {useState} from 'react';
import {Bot,RotateCcw,ShieldCheck,AlertTriangle,ChevronDown,ChevronUp} from 'lucide-react';
import type {HermesRebuildRun} from '@/lib/hermes-company-service';

const sectors:Record<string,string>={processos:'Consulta judicial',operacao:'Retornos',agentes:'Engenharia e agentes'};
const fmt=(d:string)=>new Date(d).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
export function HermesRebuildPanel({runs,onRefresh}:{
  runs:HermesRebuildRun[];onRefresh:()=>Promise<void>;
}){
 const [busy,setBusy]=useState(false),[open,setOpen]=useState(true),[error,setError]=useState('');
 const current=runs[0];
 async function run(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/hermes-office?action=rebuild',{
    method:'POST',credentials:'same-origin',headers:{Accept:'application/json'}});
   const json=await response.json();
   if(!response.ok||!json.ok)throw Error(json.error||'Auditoria não concluída.');
   await onRefresh();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível executar a auditoria.');}
  finally{setBusy(false);}
 }
 return <section className="h3d-panel-card p-5" aria-label="Swarm Rebuild com verificações reais" id="hermes-swarm-rebuild">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <h2 className="flex items-center gap-2 text-lg font-black text-white"><Bot size={20} className="text-[#f0c0d5]"/> Swarm Rebuild · autoavaliação verificável</h2>
     <p className="mt-1 max-w-2xl text-xs leading-5 text-[#dccbd7]">O sistema confere a qualidade dos resultados já registrados, ajusta a ordem de triagem e programa retentativas seguras. Sugestões que alteram código precisam de testes antes de entrar em produção.</p>
    </div>
    <button type="button" disabled={busy} className="h3d-button" onClick={()=>void run()}><RotateCcw size={15} className={busy?'animate-spin':''}/>{busy?'Auditando…':'Executar autoavaliação'}</button>
   </div>
   {error&&<p role="alert" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-100">{error}</p>}
   {!current?<p className="mt-3 rounded-lg border border-white/15 p-4 text-sm text-[#d5c3cf]">Ainda não há auditoria real registrada; use o botão para analisar os indicadores da empresa.</p>:<>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
     {[
      ['Consultas com evidência',current.evidence_count],
      ['Eventos inspecionados',current.findings_count],
      ['Melhorias avaliadas',current.recommendations.length],
      ['Retornos vencidos ativos',current.input_metrics?.overdue||0]
     ].map(([label,n])=><div key={String(label)} className="h3d-kpi"><strong className="block text-2xl font-black tabular-nums">{Number(n)}</strong><span className="mt-1 block text-xs text-[#e3d1dd]">{label}</span></div>)}
    </div>
    <p className="mt-3 flex items-center gap-2 text-xs text-[#d6c3d0]"><ShieldCheck size={14}/> Último ciclo: {fmt(current.recorded_at)} · {current.state==='audited'?'Evidências analisadas':'Sem novas evidências suficientes'}</p>
    <button type="button" className="mt-3 flex items-center gap-2 text-sm font-bold text-[#f0d2e0] underline underline-offset-4" onClick={()=>setOpen(x=>!x)}>
       Revisar recomendações {open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
    </button>
    {open&&<div className="mt-3 grid gap-3 md:grid-cols-3">
      {current.recommendations.map((s,i)=><article key={i} className="rounded-xl border border-white/15 bg-[#2c2130] p-3 text-xs text-[#eee0e9]">
       <p className="font-black text-[#f7cfdf]">{sectors[s.sector]||s.sector}</p>
       <p className="mt-2 leading-5">{s.action}</p>
       <p className="mt-2 text-[11px] text-[#d5c3cf]">Registros associados: {s.evidence}. {s.automated?'Política segura automatizada.':'Proposta pendente de validação técnica.'}</p>
      </article>)}
     </div>}
   </>}
   <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[#cebccb]"><AlertTriangle size={14} className="mt-0.5 shrink-0"/> Os robôs não se reprogramam em produção, não editam peças jurídicas e não mandam mensagens. A evolução automática limita-se a auditoria, classificação e retentativas registradas.</p>
 </section>;
}
