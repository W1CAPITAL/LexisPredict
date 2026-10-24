"use client";

import {useMemo,useRef,useState} from "react";
import Link from "next/link";
import {Sidebar} from "@/components/layout/sidebar";
import {Button} from "@/components/ui/button";
import {
  ArrowRight,BrainCircuit,CheckCircle2,ClipboardList,FileSearch,
  Fingerprint,Network,ShieldCheck,UploadCloud,TriangleAlert,Workflow,
  X,Search,Download,ExternalLink
} from "lucide-react";
import {
  ROUTE_INVENTORY,ROUTE_PLAYBOOKS,recommendAgentTeamForRoute
} from "@/lib/agent-improvements/route-playbooks";
import {inspectAuthorizedHar,MAX_HAR_BYTES,type ApiObservation} from "@/lib/agent-improvements/har-observer";

export default function StudioAgentesPage(){
  const [active,setActive]=useState(ROUTE_PLAYBOOKS[0].id);
  const [filter,setFilter]=useState("");
  const [selectedRoute,setSelectedRoute]=useState("/");
  const [har,setHar]=useState<ApiObservation|null>(null);
  const [harError,setHarError]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const current=ROUTE_PLAYBOOKS.find(x=>x.id===active)||ROUTE_PLAYBOOKS[0];
  const shown=useMemo(()=>ROUTE_PLAYBOOKS.filter(p=>
    (p.title+' '+p.description+' '+p.routes.join(' ')).toLowerCase().includes(filter.toLowerCase().trim())
  ),[filter]);
  const selection=current.routes.includes(selectedRoute)?selectedRoute:current.routes[0];
  const plan=recommendAgentTeamForRoute(selection);
  const handleHar=async(file:File|undefined)=>{
    if(!file)return;
    setHarError("");setHar(null);
    if(!confirmed){setHarError("Confirme que o HAR foi exportado de um ambiente próprio ou autorizado.");return;}
    if(file.size>MAX_HAR_BYTES){setHarError("Arquivo maior que 3 MB. Exporte uma janela menor no DevTools.");return;}
    try{
      const text=await file.text();
      const parsed:unknown=JSON.parse(text);
      setHar(inspectAuthorizedHar(parsed));
    }catch(e){setHarError(e instanceof Error?e.message:"Não foi possível analisar este arquivo.");}
    finally{if(fileRef.current)fileRef.current.value="";}
  };
  const exportSummary=()=>{
    if(!har)return;
    const data=JSON.stringify({generatedAt:new Date().toISOString(),...har},null,2);
    const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="lexis-api-inventario-sanitizado.json";a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return(
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar/>
      <main className="lexis-main-pad min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[26px] border border-violet-300/15 bg-gradient-to-br from-[#10152d] via-[#1b2043] to-[#362063] p-6 text-white shadow-xl md:p-8">
            <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" aria-hidden/>
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wide">
                  <BrainCircuit className="h-4 w-4"/> LEXIS / INTELLIGENCE STUDIO
                </p>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Agentes por aba. Evidências antes de IA.</h1>
                <p className="mt-3 text-sm leading-6 text-[#d9dbf5]">
                  Playbooks da plataforma, inspirados em Agency Agents e Agent Skills.
                  Inclui inventário local e protegido de tráfego HAR para evoluir integrações próprias.
                  Não inicia modelos de 0,5B ou outras inferências no computador.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Áreas" value={ROUTE_PLAYBOOKS.length}/>
                <Metric label="Rotas mapeadas" value={ROUTE_INVENTORY.length}/>
                <Metric label="Modelo exigido" value="Não"/>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <SmallFeature icon={<Workflow className="h-5 w-5 text-violet-500"/>} title="Equipe especializada"
              text="Papéis claros, menor contexto, entregáveis verificáveis."/>
            <SmallFeature icon={<ShieldCheck className="h-5 w-5 text-emerald-500"/>} title="Critério de qualidade"
              text="Permissões, prova, checagem e revisão antes de ações sensíveis."/>
            <SmallFeature icon={<Network className="h-5 w-5 text-sky-500"/>} title="Observação de APIs"
              text="HAR analisado nesta aba: nenhum payload, cookie ou token é transmitido."/>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,2fr)]">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-base font-bold">Mapa das abas</h2>
              <p className="mt-1 text-xs text-muted-foreground">Selecione uma área para ver as regras especializadas.</p>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
                <input aria-label="Filtrar áreas e rotas" value={filter} onChange={e=>setFilter(e.target.value)}
                  placeholder="Filtrar módulo, rota ou função"
                  className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground"/>
              </div>
              <div className="mt-3 max-h-[570px] space-y-1 overflow-y-auto">
                {shown.map(p=>(
                  <button type="button" key={p.id} onClick={()=>{setActive(p.id);setSelectedRoute(p.routes[0]);}}
                    className={"flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors "+(active===p.id?"border border-violet-500/35 bg-violet-500/10 text-foreground":"hover:bg-muted/70 text-foreground")}>
                    <span><span className="block text-sm font-bold">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.routes.length} rotas · {p.specialists.length} especialistas</span></span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-violet-500"/>
                  </button>
                ))}
                {!shown.length?<p className="p-3 text-sm text-muted-foreground">Nenhuma área corresponde ao filtro.</p>:null}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-violet-500">PLAYBOOK / {current.id.toUpperCase()}</p>
                  <h2 className="mt-1 text-2xl font-black">{current.title}</h2><p className="mt-2 text-sm text-muted-foreground">{current.description}</p></div>
                <span className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground">{current.requiresReview?"Revisão humana":"Leitura determinística"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {current.routes.map(r=><button key={r} type="button" onClick={()=>setSelectedRoute(r)} aria-pressed={selection===r}
                  className={"rounded-lg border px-2.5 py-1.5 font-mono text-[11px] "+(selection===r?"border-violet-500 bg-violet-500/15 text-foreground":"border-border text-muted-foreground hover:text-foreground")}>{r}</button>)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-2"><Link href={selection}><ExternalLink className="h-3.5 w-3.5"/> Abrir {selection}</Link></Button>
                <span className="self-center text-xs text-muted-foreground">Plano local para a rota; não executa ações.</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Info title="Especialistas recomendados" icon={<BrainCircuit className="h-4 w-4"/>}>
                  <ul className="space-y-2 text-sm">{plan.specialists.map(role=><li key={role} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/>{role}</li>)}</ul>
                </Info>
                <Info title="Skill e mudança proposta" icon={<ClipboardList className="h-4 w-4"/>}>
                  <p className="font-mono text-xs text-violet-500">{current.skill}</p>
                  <p className="mt-2 text-sm leading-6">{current.proposed}</p>
                </Info>
              </div>
              <Info title="Evidência mínima de qualidade" icon={<Fingerprint className="h-4 w-4"/>}>
                <p className="text-sm leading-6">{current.evidence}</p>
              </Info>
              <Info title="Oportunidade de API / Reverse Engineering seguro" icon={<Network className="h-4 w-4"/>}>
                <p className="text-sm leading-6">{current.apiOpportunity}</p>
              </Info>
              <p className="text-xs text-muted-foreground">
                Este é um mapa técnico de oportunidades e regras; não significa que todos esses especialistas já executem automaticamente tarefas nesta aba.
              </p>
            </div>
          </section>

          <section id="auditoria-api" className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-500">Reverse API / modo seguro</p>
                <h2 className="mt-2 flex items-center gap-2 text-xl font-black"><FileSearch className="h-5 w-5"/> Auditor local de APIs</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Exporte um HAR do DevTools de uma aplicação que você controla ou está autorizado a testar. O Lexis inventaria método, rota anonimizada, volume,
                  latência e erros. Arquivo, cookies, tokens, cabeçalhos, queries, corpos e respostas nunca são enviados aos servidores.
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">Somente navegador • 0 tokens</span>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 text-sm">
              <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 accent-violet-600"/>
              <span>Confirmo que este HAR é de tráfego próprio ou autorizado e que devo respeitar as políticas dos serviços. Não farei engenharia reversa para contornar login, bloqueios ou restrições.</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".har,.json,application/json" className="hidden" onChange={e=>void handleHar(e.target.files?.[0])}/>
              <Button onClick={()=>fileRef.current?.click()} disabled={!confirmed} className="gap-2"><UploadCloud className="h-4 w-4"/> Inspecionar HAR (até 3 MB)</Button>
              {har?<Button variant="outline" onClick={exportSummary} className="gap-2"><Download className="h-4 w-4"/> Exportar resumo sanitizado</Button>:null}
              {har?<Button variant="ghost" onClick={()=>{setHar(null);setHarError("");}} className="gap-2"><X className="h-4 w-4"/> Limpar</Button>:null}
            </div>
            {harError?<div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300"><TriangleAlert className="h-4 w-4 shrink-0"/>{harError}</div>:null}
            {har?(
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <MetricLight label="Chamadas examinadas" value={har.total}/>
                  <MetricLight label="Endpoints agrupados" value={har.endpoints.length}/>
                  <MetricLight label="Indicadores sensíveis descartados" value={har.redactedCredentials}/>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[610px] text-left text-xs">
                    <thead className="bg-muted/60 text-foreground"><tr><th className="p-3">Host / rota anonimizada</th><th>Método</th><th>Chamadas</th><th>5xx/erro</th><th>401/403</th><th>429</th><th>Latência média</th></tr></thead>
                    <tbody>{har.endpoints.map((item,i)=><tr key={i} className="border-t border-border">
                      <td className="break-all p-3 font-mono">{item.host}{item.route}</td><td>{item.method}</td><td>{item.calls}</td><td>{item.errors}</td><td>{item.authFailures}</td><td>{item.limited}</td><td>{item.latencyMs}ms</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h3 className="font-bold">Diagnóstico de integração</h3>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">{har.suggestions.map(s=><li key={s} className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-violet-500"/>{s}</li>)}</ul>
                </div>
              </div>
            ):null}
          </section>
          <p className="text-xs text-muted-foreground">Referências: Agency Agents (papéis), Addy Osmani Agent Skills (gates) e Reverse API Engineer (observação de endpoints). O Lexis usa implementação própria e restringe-se a tráfego já capturado com autorização.</p>
        </div>
      </main>
    </div>
  );
}

function Metric({label,value}:{label:string;value:string|number}){
 return <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-[#d9d4f7]">{label}</p></div>;
}
function MetricLight({label,value}:{label:string;value:number}){
 return <div className="rounded-xl border border-border bg-background p-4"><p className="text-2xl font-black">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}
function SmallFeature({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){
 return <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">{icon}<div><p className="font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>;
}
function Info({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){
 return <div className="rounded-xl border border-border bg-background/70 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-bold">{icon}{title}</p>{children}</div>;
}
