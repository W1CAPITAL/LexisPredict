"use client";

/** Central de integração jurídica — funcionalidades reais, com origem e limitações visíveis.
 * Nenhuma mensagem, cobrança ou evento é criado sem gesto do operador.
 */
import * as React from "react";
import Link from "next/link";
import {Sidebar} from "@/components/layout/sidebar";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {
  ArrowLeft,ArrowRight,CalendarDays,CheckCircle2,Cloud,Download,
  ExternalLink,FileSearch,MessageCircle,RefreshCw,Search,ShieldCheck,
  Sparkles,Wallet,Loader2,AlertTriangle,ReceiptText,BookOpen
} from "lucide-react";
import {buildCalendarEventUrl,buildIcsFile,type CalendarEventInput,normalizeLawyerSearch,type AsaasPaymentSummary} from "@/lib/integracoes-suite";
import {djenBuscaTexto} from "@/lib/djen-client";

type StatusResponse={
  ok:boolean;
  services:{
    whatsapp:{available:boolean;mode:string;automatic:boolean};
    calendar:{available:boolean;mode:string;oauthConnected:boolean};
    asaas:{available:boolean;mode:string;readOnly:boolean};
    judiciary:{available:boolean;mode:string;searchByOabCrossCourt:boolean};
    ai:{available:boolean;mode:string;automaticDecision:boolean};
  };
  financialAccess:boolean;
};
type LawyerCase={
  id:number|string;cnj:string;cliente:string;tribunal:string;advogado:string;
  status:string;ultimaMovimentacao:string;dataMovimento:string|null;proximoRetorno:string|null;
};
type PublicItem={
  id?:number|string;numeroProcesso?:string|null;numero_processo?:string|null;
  texto?:string|null;data_disponibilizacao?:string|null;siglaTribunal?:string|null;
  link?:string|null;hash?:string;
};

function localDate(dt:Date):string {
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(dt);
 const value=(type:string)=>parts.find(x=>x.type===type)?.value||"";
 return value("year")+"-"+value("month")+"-"+value("day");
}
const today=()=>localDate(new Date());
const daysAgo=(count:number)=>localDate(new Date(Date.now()-count*86400000));
const statusLabel=(active:boolean,yes:string,no:string)=>active?yes:no;
const box="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm";
const input="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
function fileDownload(content:string,name:string,kind:string){
 const blob=new Blob([content],{type:kind});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download=name;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function IntegracoesPage(){
 const [system,setSystem]=React.useState<StatusResponse|null>(null);
 const [systemError,setSystemError]=React.useState("");
 React.useEffect(()=>{
   const controller=new AbortController();
   void fetch("/api/integracoes/status",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
    .then(async r=>{const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||"Consulta não autorizada.");return x as StatusResponse;})
    .then(x=>{if(!controller.signal.aborted)setSystem(x);})
    .catch(e=>{if(!controller.signal.aborted)setSystemError(e instanceof Error?e.message:"Erro ao consultar integrações.");});
   return ()=>controller.abort();
 },[]);
 const [calendar,setCalendar]=React.useState<CalendarEventInput>({title:"Retorno de acompanhamento processual",date:"",time:"",cnj:"",notes:""});
 const calendarLink=React.useMemo(()=>{try{return buildCalendarEventUrl(calendar);}catch{return null;}},[calendar]);
 const [lawyer,setLawyer]=React.useState("");
 const [lawyerBusy,setLawyerBusy]=React.useState(false);
 const [lawyerError,setLawyerError]=React.useState("");
 const [lawyerCases,setLawyerCases]=React.useState<LawyerCase[]|null>(null);
 const [lawyerPartial,setLawyerPartial]=React.useState(false);
 const [djenBusy,setDjenBusy]=React.useState(false);
 const [djenError,setDjenError]=React.useState("");
 const [djenCases,setDjenCases]=React.useState<PublicItem[]|null>(null);
 const [dateFrom,setDateFrom]=React.useState(()=>daysAgo(30));
 const [dateTo,setDateTo]=React.useState(today);
 const [asaasBusy,setAsaasBusy]=React.useState(false);
 const [asaasError,setAsaasError]=React.useState("");
 const [asaasData,setAsaasData]=React.useState<{items:AsaasPaymentSummary[];environment:string;totalCount:number;hasMore:boolean;offset:number}|null>(null);

 async function queryLawyer(event:React.FormEvent){
  event.preventDefault();
  const name=normalizeLawyerSearch(lawyer);
  if(!name){setLawyerError("Informe ao menos três letras do nome do advogado.");return;}
  setLawyerBusy(true);setLawyerError("");setLawyerCases(null);setDjenCases(null);
  try{
    const resp=await fetch("/api/integracoes/advogados?"+new URLSearchParams({nome:name}),{credentials:"same-origin",cache:"no-store"});
    const data=await resp.json();
    if(!resp.ok||!data.ok)throw new Error(data.error||"Não foi possível consultar.");
    setLawyerCases(Array.isArray(data.records)?data.records:[]);
    setLawyerPartial(data.partial===true);
  }catch(e){setLawyerError(e instanceof Error?e.message:"Erro na carteira.");}
  finally{setLawyerBusy(false);}
 }
 async function queryDjen(){
  const name=normalizeLawyerSearch(lawyer);
  if(!name){setDjenError("Informe o nome do advogado.");return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)||dateFrom>dateTo){
    setDjenError("Selecione um intervalo válido.");return;
  }
  setDjenBusy(true);setDjenError("");setDjenCases(null);
  try{
    const result=await djenBuscaTexto({texto:name,dataInicio:dateFrom,dataFim:dateTo,itensPorPagina:35,pagina:1});
    if(!result.ok)throw new Error(result.error||"DJEN indisponível.");
    setDjenCases(result.items.slice(0,35));
  }catch(e){setDjenError(e instanceof Error?e.message:"Falha na consulta pública.");}
  finally{setDjenBusy(false);}
 }
 async function queryAsaas(offset=0){
  setAsaasBusy(true);setAsaasError("");
  try{
    const resp=await fetch("/api/integracoes/asaas?offset="+offset,{credentials:"same-origin",cache:"no-store"});
    const data=await resp.json();
    if(!resp.ok||!data.ok)throw new Error(data.error||"Asaas indisponível.");
    setAsaasData({items:Array.isArray(data.items)?data.items:[],environment:data.environment,
      totalCount:Number(data.totalCount)||0,hasMore:!!data.hasMore,offset:Number(data.offset)||0});
  }catch(e){setAsaasError(e instanceof Error?e.message:"Falha no Asaas.");}
  finally{setAsaasBusy(false);}
 }
 function downloadIcs(){
  if(!calendarLink)return;
  try{
    const text=buildIcsFile(calendar);
    fileDownload(text,"lexispredict-agenda-"+calendar.date+".ics","text/calendar;charset=utf-8");
  }catch(e){setSystemError(e instanceof Error?e.message:"Data inválida.");}
 }
 function addReturn(c:LawyerCase){
  if(!c.proximoRetorno)return;
  setCalendar({title:"Retorno processual · "+c.cliente,date:c.proximoRetorno.slice(0,10),
    cnj:c.cnj,notes:"Advogado: "+c.advogado+"\nProcesso: "+c.cnj,time:""});
  document.getElementById("agenda-google")?.scrollIntoView({behavior:"smooth",block:"center"});
 }
 const sup={label:"Sem custos de integração",tone:"bg-primary/10 text-foreground border-primary/30"};

 return <div className="flex min-h-screen bg-background text-foreground">
  <Sidebar/>
  <main className="min-w-0 flex-1 overflow-auto">
    <div className="mx-auto max-w-6xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3 items-start">
            <Button size="icon" variant="outline" asChild><Link href="/crm"><ArrowLeft size={15}/></Link></Button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">LexisPredict · Escritório conectado</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Central de integrações</h1>
              <p className="mt-1 text-sm text-muted-foreground">Comunicação, agenda, recebíveis e busca processual no mesmo fluxo, sem prometer integrações que ainda não estejam conectadas.</p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-foreground">Painel operacional</Badge>
        </div>
        {systemError&&<p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">{systemError}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            {title:"WhatsApp",sub:"Operacional",ok:system?.services.whatsapp.available??false},
            {title:"Google Agenda",sub:"Agendar manualmente",ok:system?.services.calendar.available??false},
            {title:"Asaas",sub:system?.services.asaas.mode==="production"?"Produção":"Sandbox",ok:system?.services.asaas.available??false},
            {title:"Processos/OAB",sub:"Carteira + DJEN",ok:system?.services.judiciary.available??false},
            {title:"IA",sub:"Superagente",ok:system?.services.ai.available??false},
          ].map(v=><div key={v.title} className="rounded-xl border border-border bg-card px-3 py-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold">{v.ok?<CheckCircle2 size={13} className="text-primary"/>:<span className="h-2 w-2 rounded-full bg-muted-foreground"/>}{v.title}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{!system?"Consultando…":v.ok?v.sub:"Aguardando conexão"}</p>
          </div>)}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={box} aria-label="WhatsApp integrado">
          <div className="flex gap-3 items-start">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-2"><MessageCircle className="text-primary" size={20}/></div>
            <div className="flex-1">
              <h2 className="font-bold text-base">WhatsApp da equipe</h2>
              <p className="text-xs text-muted-foreground">Atendimentos e mensagens relacionados à carteira, com revisão antes do envio.</p>
            </div>
            <Badge variant="secondary">Já existe</Badge>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3 text-xs text-muted-foreground">
            Use o módulo de comunicação atual; a conexão gratuita via WhatsApp Web depende da sessão do operador.
            A API oficial de envio automático é outra modalidade e pode ter cobrança por mensagem.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/whatsapp"><MessageCircle size={14} className="mr-2"/> Abrir atendimento <ArrowRight size={13} className="ml-1"/></Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/tarefas">Fila da equipe</Link></Button>
          </div>
        </section>

        <section className={box} id="agenda-google" aria-label="Google Agenda">
          <div className="flex gap-3 items-start">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-2"><CalendarDays className="text-primary" size={20}/></div>
            <div className="flex-1">
              <h2 className="font-bold text-base">Agenda Google</h2>
              <p className="text-xs text-muted-foreground">Agende retornos, reuniões ou compromissos jurídicos sem pagar por API.</p>
            </div>
            <Badge variant="outline">Com confirmação</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="col-span-2 block space-y-1 text-xs font-semibold">Compromisso
              <input className={input} value={calendar.title} onChange={e=>setCalendar(x=>({...x,title:e.target.value}))} maxLength={180}/>
            </label>
            <label className="block space-y-1 text-xs font-semibold">Data
              <input type="date" className={input} value={calendar.date} onChange={e=>setCalendar(x=>({...x,date:e.target.value}))}/>
            </label>
            <label className="block space-y-1 text-xs font-semibold">Hora (opcional)
              <input type="time" className={input} value={calendar.time||""} onChange={e=>setCalendar(x=>({...x,time:e.target.value}))}/>
            </label>
            <label className="col-span-2 block space-y-1 text-xs font-semibold">CNJ de referência (opcional)
              <input className={input} value={calendar.cnj||""} onChange={e=>setCalendar(x=>({...x,cnj:e.target.value}))} placeholder="Número do processo" maxLength={35}/>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {calendarLink?<Button asChild size="sm"><a href={calendarLink} target="_blank" rel="noopener noreferrer"><CalendarDays size={14} className="mr-2"/> Adicionar ao Google <ExternalLink size={12} className="ml-1"/></a></Button>:
              <Button size="sm" disabled>Preencha título e data</Button>}
            <Button size="sm" variant="outline" disabled={!calendarLink} onClick={downloadIcs}><Download size={14} className="mr-2"/> Exportar .ics</Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">O evento é criado na sua própria Agenda após confirmação. Sincronização bidirecional automática exige conexão OAuth, ainda não ativada no app.</p>
        </section>

        <section className={box} aria-label="Asaas financeiro">
          <div className="flex gap-3 items-start">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-2"><Wallet size={20} className="text-primary"/></div>
            <div className="flex-1">
              <h2 className="font-bold text-base">Asaas · cobranças e recebíveis</h2>
              <p className="text-xs text-muted-foreground">Consulta segura de cobranças existentes, com Sandbox de testes.</p>
            </div>
            <Badge variant="outline">{system?.services.asaas.available?"Configurado":"Sem chave"}</Badge>
          </div>
          <div className="mt-3 rounded-xl border border-border p-3 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Modo somente leitura:</span> nenhuma cobrança será emitida, cancelada ou paga por esta tela. Na Vercel, a administração configura a chave privada <code className="text-foreground">ASAAS_API_KEY</code> e, para testes, <code>ASAAS_ENV=sandbox</code>.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={asaasBusy||!system?.services.asaas.available||!system?.financialAccess} onClick={()=>void queryAsaas(0)}>
              {asaasBusy?<Loader2 size={14} className="mr-2 animate-spin"/>:<RefreshCw size={14} className="mr-2"/>} Consultar cobranças
            </Button>
            <Button size="sm" variant="outline" asChild><Link href="/crm/financeiro">Financeiro Lexis</Link></Button>
            <Button size="sm" variant="outline" asChild><a href="https://sandbox.asaas.com" target="_blank" rel="noopener noreferrer">Abrir Sandbox <ExternalLink size={12} className="ml-1"/></a></Button>
          </div>
          {asaasError&&<p role="alert" className="mt-3 text-xs text-destructive">{asaasError}</p>}
          {asaasData&&<div className="mt-3 space-y-2">
            <p className="text-xs font-semibold">{asaasData.totalCount} cobrança(s) · {asaasData.environment==="sandbox"?"Ambiente de teste":"Produção"}</p>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {asaasData.items.map(p=><div key={p.id} className="flex items-center justify-between gap-2 border-b border-border py-2 text-xs">
                <div><p className="font-mono font-semibold">{p.id}</p><p className="text-muted-foreground">{p.status} · vence {p.dueDate}</p></div>
                <strong className="whitespace-nowrap">R$ {p.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>
              </div>)}
              {!asaasData.items.length&&<p className="text-xs text-muted-foreground">Nenhuma cobrança encontrada nesta página.</p>}
            </div>
            {asaasData.hasMore&&<Button variant="outline" size="sm" disabled={asaasBusy} onClick={()=>void queryAsaas(asaasData.offset+15)}>Próxima página</Button>}
          </div>}
        </section>

        <section className={box} aria-label="Inteligência artificial e processos">
          <div className="flex gap-3 items-start">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-2"><Sparkles size={20} className="text-primary"/></div>
            <div className="flex-1">
              <h2 className="font-bold text-base">Lexis Superagente</h2>
              <p className="text-xs text-muted-foreground">Análise de movimentações, situação do cliente, documentos e dossiês com evidências.</p>
            </div>
            <Badge variant="secondary">IA existente</Badge>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
            Fluxo recomendado: localizar processos de um advogado, selecionar o CNJ, verificar a movimentação e abrir o Superagente. IA não substitui confirmação de decisões ou prazos judiciais no tribunal.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" asChild><Link href="/chat"><Sparkles size={14} className="mr-2"/> Abrir Superagente</Link></Button>
            <Button size="sm" variant="outline" asChild><Link href="/processos">Processos da empresa</Link></Button>
            <Button size="sm" variant="outline" asChild><Link href="/dossies">Dossiês</Link></Button>
          </div>
        </section>
      </div>

      <section className={box} aria-label="Busca de processos por advogado">
        <div className="flex gap-3 items-start">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-2"><FileSearch size={20} className="text-primary"/></div>
          <div className="flex-1">
            <h2 className="font-bold text-lg">Localizar processos pelo nome do advogado</h2>
            <p className="text-xs text-muted-foreground">Cruza os registros da sua carteira e permite pesquisar publicações recentes no DJEN oficial. As duas fontes são mostradas separadamente.</p>
          </div>
          <Badge variant="outline">Consulta gratuita</Badge>
        </div>
        <form onSubmit={queryLawyer} className="mt-4 flex flex-wrap gap-2">
          <label className="flex-1 min-w-[220px] text-xs font-semibold space-y-1">Nome do advogado
            <input className={input} value={lawyer} onChange={e=>setLawyer(e.target.value)} placeholder="Ex.: Maria da Silva" maxLength={95}/>
          </label>
          <Button type="submit" className="self-end" disabled={lawyerBusy}>{lawyerBusy?<Loader2 size={14} className="mr-2 animate-spin"/>:<Search size={14} className="mr-2"/>} Buscar carteira</Button>
        </form>
        {lawyerError&&<p role="alert" className="mt-2 text-xs text-destructive">{lawyerError}</p>}
        {lawyerCases&&<div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{lawyerCases.length} registro(s) no escopo autorizado da empresa</p>
            <span className="text-[11px] text-muted-foreground">{lawyerPartial?"Exibindo apenas os 60 mais recentes":"Busca concluída na carteira"}</span>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {lawyerCases.map(c=><div className="rounded-xl border border-border bg-muted/20 p-3" key={c.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div><p className="text-xs font-bold">{c.cliente||"Cliente não informado"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{c.cnj||"CNJ ausente"} · {c.tribunal||"Tribunal não informado"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{c.ultimaMovimentacao||"Sem movimentação cadastrada"} {c.dataMovimento?"· "+c.dataMovimento.slice(0,10):""}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {c.cnj&&<Button size="sm" variant="outline" asChild><Link href={"/processos?search="+encodeURIComponent(c.cnj)}>Ver processo</Link></Button>}
                  {c.cnj&&<Button size="sm" asChild><Link href={"/chat?cnj="+encodeURIComponent(c.cnj)}><Sparkles size={13} className="mr-1"/> Analisar IA</Link></Button>}
                  {c.proximoRetorno&&<Button size="sm" variant="outline" onClick={()=>addReturn(c)}><CalendarDays size={13} className="mr-1"/> Agendar retorno</Button>}
                </div>
              </div>
            </div>)}
            {!lawyerCases.length&&<p className="text-sm text-muted-foreground">Nenhum processo deste advogado na carteira visível. Isso não significa que ele não tenha processos em outros tribunais.</p>}
          </div>
        </div>}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-start">
            <div>
              <p className="text-sm font-bold flex items-center gap-2"><BookOpen size={15} className="text-primary"/> Consultar publicações no DJEN público</p>
              <p className="text-xs text-muted-foreground">Consulta pelo texto do nome, na janela informada. Pode haver homônimos, resultados incompletos e limitação do tribunal.</p>
            </div>
            <Badge variant="outline">Fonte oficial · não exaustiva</Badge>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs space-y-1"><span>De</span><input type="date" className={input} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label>
            <label className="text-xs space-y-1"><span>Até</span><input type="date" className={input} value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label>
            <Button size="sm" variant="outline" disabled={djenBusy} onClick={()=>void queryDjen()}>
              {djenBusy?<Loader2 size={14} className="mr-2 animate-spin"/>:<Search size={14} className="mr-2"/>} Consultar DJEN
            </Button>
          </div>
          {djenError&&<p role="alert" className="text-xs text-destructive">{djenError}</p>}
          {djenCases&&<div className="space-y-2 max-h-72 overflow-y-auto">
            <p className="text-xs text-muted-foreground">{djenCases.length} publicações retornadas na primeira página. Uma publicação não prova a representação atual pelo advogado.</p>
            {djenCases.map((p,i)=>{
              const cnj=String(p.numeroProcesso||p.numero_processo||"");
              const rawLink=String(p.link||"");
              const link=rawLink.startsWith("https://")?rawLink:p.hash?"https://comunica.pje.jus.br/consulta?hash="+encodeURIComponent(p.hash):"";
              return <div key={String(p.id||i)} className="rounded-lg border border-border bg-card p-2 text-xs">
                <p className="font-bold">{cnj||"CNJ não informado"} · {p.siglaTribunal||"DJEN"}</p>
                <p className="mt-1 text-muted-foreground">{p.data_disponibilizacao||"Data não informada"} · {String(p.texto||"Publicação sem teor").slice(0,170)}</p>
                <div className="mt-1 flex gap-3">
                  {cnj&&<Link href={"/chat?cnj="+encodeURIComponent(cnj)} className="underline text-primary">Analisar registro</Link>}
                  {link&&<a href={link} target="_blank" rel="noopener noreferrer" className="underline text-primary">Abrir fonte oficial</a>}
                </div>
              </div>;
            })}
          </div>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary"/><span><strong className="text-foreground">Integrações verificáveis.</strong> O WhatsApp depende da sessão conectada; a Agenda abre um evento para confirmação; o Asaas só consulta se houver chave de API; a busca por advogado usa a carteira da empresa e publicações do DJEN. Monitoramento externo integral por OAB, cobrança automatizada e sincronização bidirecional ainda exigem configuração ou serviços adicionais. Nenhum envio, cobrança ou cadastro externo é realizado automaticamente por esta tela.</span></p>
      </section>
    </div>
  </main>
 </div>;
}
