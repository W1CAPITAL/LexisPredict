'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,RefreshCcw,Clock3,ExternalLink} from 'lucide-react';
import {getHermesStalledForParadosAction} from '@/app/actions/hermes-stalled-actions';
import type {HermesStalledSummary} from '@/lib/hermes-company-service';
import {summarizeHermesStalled} from '@/lib/hermes-stalled-ui';

function fmtDay(raw:string|null){
 const date=String(raw||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Não informado';
 return date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4);
}
const stateLabel:Record<HermesStalledSummary['state'],string>={
 scanning:'Investigando',
 confirmed_idle:'Sem movimento recente no DataJud consultado',
 recent_movement:'Movimento recente encontrado',
 no_dated_movement:'Movimento sem data verificável',
 partial:'Consulta parcial',
 unavailable:'Consulta indisponível',
};
export function HermesStalledInline(){
 const [items,setItems]=useState<HermesStalledSummary[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   try{
    const result=await getHermesStalledForParadosAction();
    if(!active)return;
    if(result.ok){setItems(result.items);setError('');}
    else setError(result.error);
   }catch{
    if(active)setError('Consulta do monitor Hermes indisponível.');
   }finally{
    if(active)setLoading(false);
   }
  };
  void refresh();
  const poll=window.setInterval(()=>void refresh(),90_000);
  return ()=>{active=false;window.clearInterval(poll);};
 },[]);
 const summary=useMemo(()=>summarizeHermesStalled(items),[items]);
 return <section aria-label="Investigação Hermes automática" className="rounded-2xl border border-border/70 bg-card/80 p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div>
    <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Activity size={17}/> Hermes · investigação automática</h2>
    <p className="mt-1 text-xs text-muted-foreground">Dados da última varredura agendada pelo servidor, atualizados nesta tela a cada 90 segundos. A consulta parcial não comprova ausência de andamento.</p>
   </div>
   <Link href="/hermes-3d#hermes-stalled-monitoring" className="inline-flex items-center gap-1 text-xs font-semibold text-foreground underline">Ver monitor completo <ExternalLink size={12}/></Link>
  </div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
   {[
    ['Investigados exibidos',summary.total],
    ['Sem movimento recente confirmado',summary.confirmedIdle],
    ['Com movimento recente',summary.recent],
    ['Consulta parcial',summary.partial],
   ].map(([label,value])=><div key={label} className="rounded-lg border border-border/60 bg-background/60 p-2">
    <p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
   </div>)}
  </div>
  {loading?<p className="text-xs text-muted-foreground"><RefreshCcw size={13} className="inline animate-spin"/> Carregando verificações...</p>:null}
  {error?<p role="status" className="text-xs text-amber-700 dark:text-amber-300">{error}</p>:null}
  {!loading&&!error&&!items.length?<p className="text-xs text-muted-foreground">Ainda não há investigações registradas para esta empresa.</p>:null}
  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
   {items.slice(0,6).map(item=><article key={item.processId} className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1.5">
    <div className="flex items-start justify-between gap-2">
     <p className="min-w-0 truncate text-xs font-bold text-foreground" title={item.client}>{item.client}</p>
     <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{stateLabel[item.state]}</span>
    </div>
    <p className="font-mono text-[10px] text-muted-foreground">{item.cnj}</p>
    <p className="text-[11px] text-muted-foreground"><Clock3 size={11} className="mr-1 inline"/>Verificado em {fmtDay(item.checkedAt)}</p>
    <p className="text-[11px] text-muted-foreground">Último movimento conhecido: {fmtDay(item.lastMovementAt)}</p>
    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
     <span>Fonte DataJud: {item.datajudOk?'respondeu':'pendente'}</span>
     <span>Fonte DJEN: {item.djenOk?'respondeu':'pendente'}</span>
    </div>
    <Link href={'/processos?search='+encodeURIComponent(item.cnj||String(item.processId))} className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-foreground underline">Abrir processo <ExternalLink size={11}/></Link>
   </article>)}
  </div>
  {summary.total>6?<p className="text-[11px] text-muted-foreground">Exibindo 6 dos {summary.total} registros recentes. O monitor Hermes reúne as demais investigações.</p>:null}
 </section>;
}
