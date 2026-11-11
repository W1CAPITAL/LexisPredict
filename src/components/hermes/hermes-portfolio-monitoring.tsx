'use client';
import {useState} from 'react';
import {getHermesPortfolioByCnjAction} from '@/app/actions/hermes-portfolio-actions';
import Link from 'next/link';
import {Activity,CalendarDays,ShieldAlert} from 'lucide-react';
import type {HermesPortfolioCaseSummary} from '@/lib/hermes-company-service';
const d=(s?:string|null)=>s&&/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const age=(value:unknown)=>{const ms=Date.parse(String(value||''));if(!Number.isFinite(ms))return '';const hours=Math.max(0,Math.floor((Date.now()-ms)/3600000));return hours<24?hours+'h':Math.floor(hours/24)+'d';};
const merits:Record<string,string>={procedente:'Procedente',parcialmente_procedente:'Parcialmente procedente',improcedente:'Improcedente'};
type SavedEvent={source:'DataJud'|'DJEN'|'TJPR PROJUDI';at:string;text:string;url?:string|null};
function HistoryButton({cnj}:{cnj:string}){
 const [events,setEvents]=useState<SavedEvent[]>([]);
 const [loading,setLoading]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [opened,setOpened]=useState(false);
 const [error,setError]=useState('');
 async function load(){
  if(loading)return;
  if(loaded){setOpened(v=>!v);return;}
  setLoading(true);setError('');
  try{
   const response=await getHermesPortfolioByCnjAction(cnj);
   if(!response.ok||!response.found){
    setError('Histórico oficial não disponível para este processo ou usuário.');return;
   }
   const rows=Array.isArray(response.events)?response.events:[];
   setEvents(rows.filter((e):e is SavedEvent=>
      e!==null&&typeof e==='object'&&
      (e.source==='DataJud'||e.source==='DJEN'||e.source==='TJPR PROJUDI')&&typeof e.text==='string'
    ).slice(0,60));
   setLoaded(true);setOpened(true);
  }catch{setError('Falha ao carregar os eventos judiciais.');}
  finally{setLoading(false);}
 }
 return <div className="mt-3 border-t border-border pt-3">
  <button type="button" onClick={()=>void load()} disabled={loading}
   className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50">
   {loading?'Carregando fontes...':opened?'Ocultar histórico':'Carregar histórico'}
  </button>
  {error&&<p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
  {opened&&<div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-muted/25 p-2">
    <p className="text-xs text-muted-foreground">Histórico recuperado pelo Hermes; pode estar incompleto quando a fonte não respondeu. DJEN não substitui a consulta aos autos.</p>
    {events.length===0?<p className="text-xs text-muted-foreground">Nenhum evento recuperado nesta consulta.</p>:
     <ol className="space-y-2">{events.map((e,i)=><li key={i} className="rounded-md border border-border bg-card p-2">
      <p className="text-xs font-bold">{e.source==='DataJud'?'Movimentação DataJud':e.source==='DJEN'?'Publicação DJEN':'Movimentação TJPR PROJUDI'} · {d(e.at)}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{e.text.slice(0,550)}</p>
      {e.url?.startsWith('https://')&&<a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-block text-xs font-semibold underline">Consultar fonte</a>}
     </li>)}</ol>}
   </div>}
 </div>;
}
export function HermesPortfolioMonitoring({items}:{items:HermesPortfolioCaseSummary[]}){
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" id="hermes-portfolio-monitor">
  <div>
   <p className="text-xs font-bold uppercase tracking-widest text-[#8c4b67] dark:text-[#eab9ce]">Hermes · scanner de toda a empresa</p>
   <h2 className="mt-1 flex items-center gap-2 text-xl font-black"><Activity size={20}/> Histórico judicial e sinais relevantes</h2>
   <p className="mt-2 text-sm text-muted-foreground">Todos os processos da carteira com CNJ válido são elegíveis, mesmo sem retorno vencido ou paralisação. Movimentações DataJud, consultas diretas do tribunal e publicações DJEN são fontes diferentes. Os sinais dependem do teor recuperado, sem criar decisões ou valores.</p>
  </div>
  {!items.length?<p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aguardando o primeiro processamento da nova fila judicial.</p>:
   <div className="grid gap-3 lg:grid-cols-2">{items.slice(0,24).map(r=>{
    const f=r.findings||{},m=f.verdict,hearing=Array.isArray(f.hearings)?f.hearings[0]:null;
    const freshness=f.datajudFreshness&&typeof f.datajudFreshness==='object'?f.datajudFreshness as Record<string,unknown>:null;
    return <article key={r.processId} className="rounded-xl border border-border bg-background/60 p-4">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-bold">{r.client}</p><p className="break-all font-mono text-xs text-muted-foreground">{r.cnj}</p></div>
      <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold">{r.state==='ready'?'Duas fontes':r.state==='partial'?'Consulta parcial':'Pendente'}</span>
     </div>
     <p className="mt-2 text-xs text-muted-foreground">Verificado: {d(r.checkedAt)} · DataJud {r.datajudOk?'✓':'pendente'} · DJEN {r.djenOk?'✓':'pendente'}{r.tribunalApiSource?' · '+r.tribunalApiSource+' '+(r.tribunalApiOk?'✓':r.tribunalApiAttempted?'pendente':'não acionado'):''}</p>
     <p className="mt-1 text-xs text-muted-foreground">Último movimento: {d(f.latestCourtMovement)} · Publicação DJEN: {d(f.latestDjenPublication)}</p>
     {freshness?.updatedAt&&<p className="mt-1 text-xs text-muted-foreground">DataJud · atualização informada: {d(String(freshness.updatedAt))} (há {age(freshness.updatedAt)}){freshness.indexTimestamp?' · indexação: '+d(String(freshness.indexTimestamp))+' (há '+age(freshness.indexTimestamp)+')':''}</p>}
     {m?.value&&<p className="mt-2 rounded-lg border border-border p-2 text-sm font-bold">{merits[m.value]||m.value} · {m.source} <span className="block text-xs font-normal text-muted-foreground">{String(m.excerpt||'').slice(0,240)}</span></p>}
     {hearing&&<p className="mt-2 flex flex-wrap items-center gap-2 text-xs"><CalendarDays size={14}/> {hearing.kind||'Audiência'} · {d(hearing.date)}{hearing.time?' às '+hearing.time:''}{hearing.meetingUrl?<a href={hearing.meetingUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Link indicado no ato</a>:null}</p>}
     {f.enforcement?.value&&<p className="mt-1 text-xs">Cumprimento de sentença: {f.enforcement.value==='cumprimento_iniciado'?'sinal de instauração':'menção localizada'} · {f.enforcement.source}</p>}
     {f.attorneyFees?.value&&<p className="mt-1 text-xs">Honorários sucumbenciais: menção oficial{typeof f.attorneyFees.percentage==='number'?' · '+f.attorneyFees.percentage+'%':''} · conferir dispositivo</p>}
     {f.legalAid?.value&&<p className="mt-1 text-xs">Justiça gratuita: {f.legalAid.value} no texto · {f.legalAid.source}</p>}
     {f.courtCosts?.value&&<p className="mt-1 text-xs">Custas: {f.courtCosts.amount||'valor não localizado'} · exigibilidade não verificada</p>}
     {!m&&!hearing&&!f.enforcement&&!f.attorneyFees&&!f.courtCosts&&!f.legalAid&&<p className="mt-2 text-xs text-muted-foreground">Nenhum sinal dessas categorias recuperado; isso não confirma que os autos estejam sem movimentação.</p>}
     {r.state!=='ready'&&<p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert size={13} className="shrink-0"/> {r.sourceErrors.datajud||r.sourceErrors.djen||'Fonte pendente de confirmação'}</p>}
     {r.sourceErrors.projudi&&<p className="mt-1 text-xs text-amber-700 dark:text-amber-300">TJPR PROJUDI MNI: {r.sourceErrors.projudi}</p>}
     <HistoryButton cnj={r.cnj}/>
     <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold underline">
      <Link href={'/veredito?cnj='+encodeURIComponent(r.cnj)}>Consultar no Veredito</Link>
      <Link href={'/processos?search='+encodeURIComponent(r.cnj)}>Abrir processo</Link>
     </div>
    </article>;
   })}</div>}
  <p className="text-xs leading-relaxed text-muted-foreground">O relatório é operacional. Um rótulo no DataJud ou uma publicação DJEN não substituem o inteiro teor da sentença nem confirmam honorários devidos, custas exigíveis ou pagamento. CAPTCHA e autenticação dos portais não são contornados.</p>
 </section>;
}
