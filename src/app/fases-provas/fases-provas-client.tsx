"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
type CaseRecord = Record<string, any>;
type Row = { cnj:string; cliente:string; escritorio:string; advogado:string; status:string; fase:string; leitura:string; registro:string; origem:string; datajud:string; djen:string; comercial:string; motivos:string; tipo:"replica"|"provas" };
const PAGE_SIZE=400, MAX_ROWS=10_000;
const normalize=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const dateLabel=(value:unknown)=>{if(!value)return "Sem data";const d=new Date(String(value));return Number.isFinite(d.getTime())?d.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}):String(value).slice(0,10)};
function classify(note:string,summary:string,type:"replica"|"provas"){
 const n=normalize(note),d=normalize(summary);
 if(/sentenca|improcedent|procedent|extincao|arquivamento|baixa definitiva/.test(d))return{fase:"Revisar decisão posterior",leitura:"O DJEN menciona decisão/encerramento; a anotação de fase pode estar ultrapassada."};
 if(type==="replica"){
  if(/nao apresent|nao foi apresentada|prazo decorrid|passado prazo|perda de prazo|ausencia replica/.test(n))return{fase:"Conferir prazo / não apresentada",leitura:"Conferir intimação e petição protocolada antes de concluir perda de prazo."};
  if(/replica (apresentad|juntad|realizad|protocolad)|apresentamos a replica|apos apresentarmos a replica/.test(n))return{fase:"Réplica informada como enviada",leitura:"Confirmar protocolo e próximo andamento no tribunal."};
  if(/aguard.{0,35}replica|apresentar.{0,15}replica|realizar replica|intimad.{0,45}replica/.test(n))return{fase:"Aguardando réplica",leitura:"Conferir se o prazo está aberto e quem deve peticionar."};
  return{fase:"Referência à réplica",leitura:"A palavra aparece no histórico, mas não comprova fase atual."};
 }
 if(/provas (juntad|apresentad|protocolad)|juntada de provas|manifestacao de provas.*apresent|protocolamos nossa manifestacao/.test(n))return{fase:"Provas informadas como enviadas",leitura:"Confirmar protocolo/recebimento dos documentos."};
 if(/intimad.{0,70}(provas|documentos)|aguard.{0,30}(provas|documentos)|especificacao de provas|producao de provas|apresentacao de provas|envio de provas/.test(n+" "+d))return{fase:"Provas / verificar envio",leitura:"Conferir despacho, necessidade de documentos e prazo."};
 if(/pericia|laudo|perito/.test(n))return{fase:"Perícia / laudo",leitura:"Conferir andamento e eventual manifestação técnica."};
 return{fase:"Referência a provas",leitura:"Não comprova prazo para enviar documentos."};
}
function classifySale(status:string,phase:string){
 if(normalize(status).includes("encerrado"))return["Não oferecer","Processo encerrado na carteira."];
 if(/Revisar decisão|Conferir prazo/.test(phase))return["Não oferecer agora","Antes, conferir prazo ou decisão com o advogado."];
 if(/Provas \/ verificar envio|Referência a provas|Perícia/.test(phase))return["Avaliar, não vender automaticamente","Somente serviço administrativo/documental adicional, necessário e fora do contrato; medida jurídica é do advogado."];
 return["Não oferecer automaticamente","Etapa processual não é motivo suficiente para nova contratação."];
}
function classifyCases(cases:CaseRecord[],seen:Set<string>):Row[]{
 const result:Row[]=[];
 for(const item of cases){
  const status=String(item.status||item.situacao||"");
  if(normalize(status).includes("encerrado")||normalize(item.status_interno).includes("encerrado"))continue;
  const note=String(item.observacao||item.observacoes||""),summary=String(item.djen_ultimo_resumo||""),extra=String(item.datajud_ultimo_nome||"");
  const content=normalize(note+" "+summary+" "+extra),cnj=String(item.protocolo||item.protocolo_ref||"").trim();
  for(const tipo of ["replica","provas"] as const){
   const matched=tipo==="replica"?/replica/.test(content):/provas|pericia|laudo pericial|instrucao probatoria/.test(content);
   if(!matched)continue;const key=cnj+":"+tipo;if(seen.has(key))continue;seen.add(key);
   const phase=classify(note,summary,tipo),[comercial,motivos]=classifySale(status,phase.fase);
   result.push({cnj,cliente:String(item.cliente||"Sem nome"),escritorio:String(item.escritorio||""),advogado:String(item.advogado||"Não atribuído"),status,fase:phase.fase,leitura:phase.leitura,registro:note.slice(0,450),origem:summary.slice(0,280),datajud:dateLabel(item.datajud_consultado_em),djen:dateLabel(item.djen_consultado_em),comercial,motivos,tipo});
  }
 }
 return result;
}
function CaseTable({items,loadingInitial,loadingMore}:{items:Row[];loadingInitial:boolean;loadingMore:boolean}){
 return <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-busy={loadingInitial||loadingMore}>
  <table className="w-full min-w-[1060px] text-sm">
   <thead className="bg-slate-900 text-white"><tr>{["Cliente / CNJ","Advogado / escritório","Fase indicada","Status","Fonte mais recente","Comercial / motivo"].map(x=><th key={x} className="p-3 text-left font-semibold">{x}</th>)}</tr></thead>
   <tbody>
    {items.map((r,i)=><tr key={r.cnj+":"+r.tipo} className={i%2?"bg-muted/40":""}>
     <td className="p-3 align-top"><b>{r.cliente}</b><div className="font-mono text-xs text-muted-foreground">{r.cnj||"CNJ não informado"}</div></td>
     <td className="p-3 align-top">{r.advogado}<div className="text-xs text-muted-foreground">{r.escritorio}</div></td>
     <td className="p-3 align-top"><b>{r.fase}</b><p className="mt-1 max-w-[280px] text-xs text-muted-foreground">{r.leitura}</p><details className="mt-1 text-xs"><summary className="cursor-pointer underline">Ver registros</summary><p className="mt-1 whitespace-pre-wrap break-words">{r.registro||"Sem observação"}</p><p className="mt-1 text-muted-foreground">{r.origem}</p></details></td>
     <td className="p-3 align-top">{r.status||"Não informado"}</td><td className="p-3 align-top text-xs">DataJud: {r.datajud}<div>DJEN: {r.djen}</div></td>
     <td className="p-3 align-top"><b>{r.comercial}</b><p className="mt-1 max-w-[290px] text-xs text-muted-foreground">{r.motivos}</p></td>
    </tr>)}
    {!items.length&&loadingInitial&&Array.from({length:4}).map((_,i)=><tr key={"loading-"+i} className="border-b border-border/60">
     <td className="p-3"><div className="lexis-skeleton h-3 w-36 rounded"/><div className="lexis-skeleton mt-2 h-3 w-24 rounded"/></td>
     <td className="p-3"><div className="lexis-skeleton h-3 w-32 rounded"/><div className="lexis-skeleton mt-2 h-3 w-20 rounded"/></td>
     <td className="p-3"><div className="lexis-skeleton h-3 w-40 rounded"/><div className="lexis-skeleton mt-2 h-3 w-52 rounded"/></td>
     <td className="p-3"><div className="lexis-skeleton h-3 w-24 rounded"/></td><td className="p-3"><div className="lexis-skeleton h-3 w-28 rounded"/><div className="lexis-skeleton mt-2 h-3 w-20 rounded"/></td><td className="p-3"><div className="lexis-skeleton h-3 w-32 rounded"/><div className="lexis-skeleton mt-2 h-3 w-44 rounded"/></td>
    </tr>)}
    {!items.length&&!loadingInitial&&<tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">{loadingMore?"Nenhuma ocorrência neste lote; a triagem continua em segundo plano.":"Nenhuma referência encontrada nos processos consultados."}</td></tr>}
   </tbody>
  </table>
 </div>;
}
export default function FasesProvasClient(){
 const [data,setData]=useState<Row[]>([]),[rowsScanned,setRowsScanned]=useState(0),[loadingInitial,setLoadingInitial]=useState(true),[loadingMore,setLoadingMore]=useState(false),[hasMore,setHasMore]=useState(true),[error,setError]=useState(""),[retryToken,setRetryToken]=useState(0);
 const nextOffset=useRef(0),seenKeys=useRef(new Set<string>());
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const run=async()=>{
   let offset=nextOffset.current;
   if(offset===0){setLoadingInitial(true);setData([]);setRowsScanned(0);seenKeys.current=new Set<string>();}
   else{setLoadingInitial(false);setLoadingMore(true);}
   setError("");
   try{
    while(active&&offset<MAX_ROWS){
     const response=await fetch("/api/carteira/fast?scope=empresa&limit="+PAGE_SIZE+"&offset="+offset+"&summary=0",{method:"GET",cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
     const payload=await response.json().catch(()=>null);
     if(!response.ok||payload?.ok!==true||!Array.isArray(payload?.cases))throw new Error(String(payload?.error||"Não foi possível consultar os processos da empresa."));
     const page=payload.cases as CaseRecord[];if(!active)return;
     const classified=classifyCases(page,seenKeys.current);
     if(offset===0)setData(classified);else if(classified.length)setData(previous=>[...previous,...classified]);
     offset+=page.length;nextOffset.current=offset;setRowsScanned(offset);
     const more=page.length===PAGE_SIZE&&offset<MAX_ROWS;setHasMore(more);setLoadingInitial(false);
     if(!more)break;setLoadingMore(true);
     // Deixa o navegador pintar e processar cliques entre lotes.
     await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    }
   }catch(cause){if(active&&!controller.signal.aborted){setError(cause instanceof Error?cause.message:"Falha ao carregar a triagem.");setHasMore(true);}}
   finally{if(active){setLoadingInitial(false);setLoadingMore(false);}}
  };
  void run();return()=>{active=false;controller.abort();};
 },[retryToken]);
 const replica=useMemo(()=>data.filter(r=>r.tipo==="replica").sort((a,b)=>a.cliente.localeCompare(b.cliente,"pt-BR")),[data]);
 const provas=useMemo(()=>data.filter(r=>r.tipo==="provas").sort((a,b)=>a.cliente.localeCompare(b.cliente,"pt-BR")),[data]);
 const unique=useMemo(()=>new Set(data.map(r=>r.cnj)).size,[data]),busy=loadingInitial||loadingMore,limitReached=rowsScanned>=MAX_ROWS&&!hasMore;
 return <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-6 text-foreground sm:px-8 sm:py-8">
  <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-9">
   <p className="text-xs font-semibold tracking-[0.17em] text-blue-200">LEXISPREDICT / CARTEIRA / TRIAGEM</p><h1 className="mt-2 text-3xl font-bold">Réplica, provas e envio de documentos</h1>
   <p className="mt-2 max-w-4xl text-sm text-slate-300">A triagem aparece assim que o primeiro lote chega. Os demais processos são consultados em segundo plano; uma menção no histórico não confirma prazo aberto nem fase atual no tribunal.</p>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[rowsScanned.toLocaleString("pt-BR"),"processos analisados"],[replica.length.toLocaleString("pt-BR"),"referências à réplica"],[provas.length.toLocaleString("pt-BR"),"provas e perícias"],[unique.toLocaleString("pt-BR"),"processos distintos"]].map(([value,title])=><div key={title} className="rounded-xl border border-white/20 bg-white/10 p-3 transition-colors duration-200"><b className="text-2xl tabular-nums">{value}</b><p className="text-xs text-slate-300">{title}</p></div>)}</div>
  </header>
  <section className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm" role="status" aria-live="polite">
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5">
    {busy?<LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary"/>:error?<AlertCircle className="h-4 w-4 shrink-0 text-destructive"/>:<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/>}
    <p className="text-sm font-semibold">{loadingInitial?"Conectando à carteira da empresa…":loadingMore?"Triagem em segundo plano — "+rowsScanned.toLocaleString("pt-BR")+" processos verificados":error?"A consulta foi interrompida":"Triagem concluída — "+rowsScanned.toLocaleString("pt-BR")+" processos verificados"}</p>
   </div>{error?<button type="button" onClick={()=>setRetryToken(n=>n+1)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><RefreshCw className="h-3.5 w-3.5"/> Retomar</button>:null}</div>
   {busy?<div className="lexis-loading-track mt-3"><span/></div>:null}
   {error?<p className="mt-2 text-xs text-destructive">{error}. Os resultados já carregados foram preservados.</p>:null}
   {limitReached?<p className="mt-2 text-xs text-muted-foreground">Limite de 10.000 registros por carregamento atingido.</p>:null}
  </section>
  <div className="flex flex-wrap items-center gap-3"><Link className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800" href="#provas">Ver provas e envios</Link><Link className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted" href="#replica">Ver réplicas</Link><Link className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-muted" href="/processos">Voltar à carteira</Link></div>
  <section id="provas" className="space-y-3 scroll-mt-6"><h2 className="text-2xl font-bold">Provas e documentos ({provas.length.toLocaleString("pt-BR")})</h2><p className="text-sm text-muted-foreground">Casos com sentença, prova já enviada ou simples menção no histórico ficam sinalizados para conferência; nenhum é marcado automaticamente como prazo aberto.</p><CaseTable items={provas} loadingInitial={loadingInitial} loadingMore={loadingMore}/></section>
  <section id="replica" className="space-y-3 scroll-mt-6"><h2 className="text-2xl font-bold">Réplica à contestação ({replica.length.toLocaleString("pt-BR")})</h2><CaseTable items={replica} loadingInitial={loadingInitial} loadingMore={loadingMore}/></section>
  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">Nenhuma oferta é aprovada automaticamente. Contrato, serviço já contratado, intimação, petição e fase judicial precisam ser conferidos antes de recomendar cobrança ou contratação adicional.</p>
 </main>;
}
