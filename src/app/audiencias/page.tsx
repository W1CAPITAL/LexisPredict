"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Sidebar} from "@/components/layout/sidebar";
import {CalendarDays,RefreshCcw,ExternalLink,Search,Gavel,Clock,ShieldCheck,AlertCircle} from "lucide-react";
type Audiencia = {
 id:number;processo_id:number;protocolo_ref:string;cliente:string|null;advogado:string|null;tribunal:string|null;
 tipo:string;data_evento:string|null;data_fim:string|null;hora_local:string|null;hora_fim:string|null;fuso:string|null;
 modalidade:string;situacao:string;fonte:string;fonte_url:string|null;portal_url:string|null;meeting_url:string|null;evidencia:string;
 verificado_em:string;
};
const nomeTipo:Record<string,string>={
 conciliacao:"Conciliação / mediação",instrucao:"Instrução",julgamento:"Julgamento",
 sessao_virtual:"Sessão virtual de julgamento",sessao_julgamento:"Sessão de julgamento",audiencia:"Audiência"
};
function formatDay(day:string|null){
 if(!day)return "Data a confirmar";
 const [y,m,d]=day.split("-");return d+"/"+m+"/"+y;
}
function todayBrazil(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const pick=(type:string)=>parts.find(p=>p.type===type)?.value||"";
 return pick("year")+"-"+pick("month")+"-"+pick("day");
}
function meetingLink(raw:string|null){if(!raw)return null;try{const u=new URL(raw);const h=u.hostname.toLowerCase();return u.protocol==='https:'&&(h==='meet.google.com'||h==='teams.microsoft.com'||h==='zoom.us'||h.endsWith('.zoom.us')||h==='webex.com'||h.endsWith('.webex.com')||h==='jus.br'||h.endsWith('.jus.br'))?u.href:null;}catch{return null;}}
function officialLink(raw:string|null){if(!raw)return null;try{const u=new URL(raw);return u.protocol==="https:"&&(u.hostname.endsWith(".jus.br")||u.hostname==="cnj.jus.br")?u.href:null;}catch{return null;}}
export default function AudienciasPage(){
 const [items,setItems]=useState<Audiencia[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[query,setQuery]=useState("");
 const [period,setPeriod]=useState("proximas"),[busy,setBusy]=useState<number|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{
   const res=await fetch("/api/audiencias",{cache:"no-store",credentials:"same-origin",signal});
   const data=await res.json();
   if(!res.ok||!data.ok)throw Error(data.error||"Não foi possível carregar os registros.");
   if(!signal?.aborted){setItems(Array.isArray(data.items)?data.items:[]);setError("");}
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"Falha de leitura");}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const control=new AbortController();void load(control.signal);
  const timer=window.setInterval(()=>{if(!document.hidden)void load(control.signal);},60000);
  return()=>{control.abort();window.clearInterval(timer);};},[load]);
 const now=todayBrazil();
 const tomorrow=useMemo(()=>{const date=new Date(now+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);},[now]);
 const filtered=useMemo(()=>{
  const term=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  return items.filter(x=>{
    const last=x.data_fim||x.data_evento;
    if(period==="proximas"&&(!last||last<now||x.situacao==="cancelada"))return false;
    if(period==="pendentes"&&x.data_evento!==null)return false;
    if(term){const blob=[x.cliente,x.advogado,x.protocolo_ref,x.tribunal,x.tipo].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();if(!blob.includes(term))return false;}
    return true;
  });
 },[items,period,query,now]);
 const tomorrowItems=items.filter(x=>x.situacao!=="cancelada"&&(x.data_evento===tomorrow||x.data_fim===tomorrow));
 const upcoming=items.filter(x=>x.situacao!=="cancelada"&&(x.data_fim||x.data_evento||"")>=now);
 async function refreshCase(id:number){
  setBusy(id);setError("");
  try{
    const res=await fetch("/api/audiencias",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({processId:id})});
    const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||"Consulta não concluída");
    await load();
  }catch(e){setError(e instanceof Error?e.message:"Falha na consulta");}
  finally{setBusy(null);}
 }
 const metric=(label:string,value:number)=><div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{value}</p></div>;
 return <div className="ops-ui flex h-screen overflow-hidden bg-background text-foreground">
  <Sidebar/>
  <main className="min-w-0 flex-1 overflow-y-auto">
   <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
     <div className="space-y-1"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><Gavel size={17}/> LexisPredict · Hermes</div>
      <h1 className="text-3xl font-bold tracking-tight">Audiências e sessões</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Datas extraídas de publicações oficiais do DJEN e movimentos do DataJud. O retorno do cliente nunca é tratado como data de audiência.</p>
     </div>
     <div className="flex flex-wrap gap-2"><Link href="/agenda" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted"><CalendarDays size={16}/> Ver agenda</Link>
      <button type="button" onClick={()=>{setLoading(true);void load();}} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" disabled={loading}><RefreshCcw size={16} className={loading?"animate-spin":""}/> Atualizar tela</button>
     </div>
    </header>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metric("Na base",items.length)}
      {metric("Próximas / em curso",upcoming.length)}
      {metric("Amanhã",tomorrowItems.length)}
      {metric("Data a verificar",items.filter(x=>x.situacao==="data_pendente").length)}
    </div>
    {error&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"><AlertCircle size={17}/>{error}</p>}
    <div className="rounded-2xl border border-border bg-card p-3">
     <div className="flex flex-wrap items-center gap-3">
      <label className="relative min-w-[210px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cliente, processo, advogado ou tribunal" className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"/></label>
      <label className="text-sm text-muted-foreground">Exibir <select value={period} onChange={e=>setPeriod(e.target.value)} className="ml-2 rounded-xl border border-input bg-background px-3 py-2 text-foreground"><option value="proximas">Próximas</option><option value="pendentes">Data a verificar</option><option value="todas">Todas</option></select></label>
     </div>
    </div>
    <div className="space-y-3">
      {!loading&&filtered.length===0&&<div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado neste filtro. Isso não comprova ausência de audiência no tribunal.</div>}
      {filtered.map(x=>{
       const url=officialLink(x.fonte_url),portal=officialLink(x.portal_url),meeting=meetingLink(x.meeting_url);
       const canceled=x.situacao==="cancelada",pending=x.situacao==="data_pendente";
       return <article key={x.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
         <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2"><span className={"rounded-full px-2.5 py-1 text-[11px] font-bold "+(canceled?"bg-muted text-muted-foreground":pending?"bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100":"bg-rose-100 text-rose-950 dark:bg-rose-900/40 dark:text-rose-100")}>{canceled?"Cancelada":pending?"Data a confirmar":nomeTipo[x.tipo]||x.tipo}</span><span className="text-xs text-muted-foreground">{x.tribunal||"Tribunal não identificado"} · {x.fonte}</span></div>
          <h2 className="text-lg font-semibold">{x.cliente||"Cliente sem nome"}</h2><p className="break-all text-xs text-muted-foreground">{x.protocolo_ref}</p>
          <p className="text-xs text-muted-foreground">Advogado: {x.advogado||"Não informado"}</p>
         </div>
         <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-left md:text-right">
          <p className="flex items-center gap-2 text-sm font-bold"><Clock size={16}/> {x.tipo==="sessao_virtual"||x.tipo==="sessao_julgamento"?"Período da sessão":"Data do evento"}</p>
          <p className="text-sm font-semibold">Início: {formatDay(x.data_evento)}{x.hora_local?" às "+x.hora_local:""} {x.fuso||"(horário do tribunal)"}</p>
          {x.data_fim&&<p className="text-sm font-semibold text-foreground">Término: {formatDay(x.data_fim)}{x.hora_fim?" às "+x.hora_fim:""}</p>}
          <p className="text-xs text-muted-foreground">{x.modalidade==="virtual"?"Virtual":x.modalidade==="presencial"?"Presencial":"Modalidade não confirmada"}</p>
         </div>
        </div>
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{x.evidencia}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {meeting&&<a className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-foreground hover:bg-primary/15" target="_blank" rel="noreferrer noopener" href={meeting}><ExternalLink size={14}/> Link da audiência citado no ato</a>}
          {url&&<a className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" target="_blank" rel="noreferrer noopener" href={url}><ExternalLink size={14}/> Ato judicial</a>}
          {portal&&<a className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" target="_blank" rel="noreferrer noopener" href={portal}><ExternalLink size={14}/> Portal de sessões</a>}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50" disabled={busy!==null} onClick={()=>void refreshCase(x.processo_id)}><RefreshCcw size={14} className={busy===x.processo_id?"animate-spin":""}/> Consultar DataJud + DJEN</button>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck size={13}/> Registro da fonte — não confirma manutenção da pauta</span>
        </div>
       </article>;
      })}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">A verificação ocorre nas consultas do scanner e do Hermes, com reindexação automática da carteira. Os portais estaduais cadastrados são links públicos, e não APIs REST verificadas; exigem consulta própria quando o ato oficial não informa a data ou possível alteração da pauta.</p>
   </div>
  </main>
 </div>;
}
