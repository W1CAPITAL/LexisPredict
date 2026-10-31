"use client";

import Link from "next/link";
import {useMemo,useState} from "react";
import {ReportPdfExportButton} from "@/components/report/report-pdf-export-button";
import {Activity,AlertTriangle,ArrowUpRight,BarChart3,BellRing,BriefcaseBusiness,CheckCircle2,ChevronRight,ClipboardList,Clock3,FileText,Filter,MessageCircle,RefreshCw,ShieldAlert,Sparkles,Users,Wallet} from "lucide-react";
import {CartesianGrid,Cell,Line,LineChart,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";

type Person={id:string;nome:string;carteira:number;atendimentos:number;encerramentos:number;edicoes:number;atividades:number};
type Day={ymd:string;atendimentos:number;encerramentos:number};
type Props={
 periodo:"esta_semana"|"semana_passada"|"mes";meus:boolean;
 canViewTeam:boolean;canExport:boolean;
 total:number|null;ativos:number|null;encerrados:number|null;novidades:number|null;vencidos:number|null;
 semRetorno:number|null;atendidos:number|null;eventos:number|null;meritoPendente:number|null;
 atividadesRegistradas:number|null;
 equipe:Person[];dias:Day[];
};
const format=(x:number|null|undefined)=>x==null?"—":x.toLocaleString("pt-BR");
const colors=["var(--lx-report-chart-1)","var(--lx-report-chart-2)","var(--lx-report-chart-3)","var(--lx-report-chart-1)","var(--lx-report-chart-2)","var(--lx-report-chart-3)"];
const panel="report-exec-panel rounded-[19px] border border-border bg-card shadow-sm";
const linkClass="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary";
function Stat({title,value,help,Icon,tone}:{title:string;value:number|null;help:string;Icon:typeof BarChart3;tone:string}){
 return <div data-report-stat={tone} className="report-exec-stat min-w-0 overflow-hidden rounded-[16px] border border-border p-4">
  <div className="flex items-center gap-3">
   <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"><Icon className="h-5 w-5"/></span>
   <span className="text-xs font-bold leading-tight text-foreground">{title}</span>
  </div>
  <div className="mt-2 pl-1 text-[clamp(1.55rem,2.1vw,2.1rem)] font-extrabold tracking-tight text-foreground tabular-nums">{format(value)}</div>
  <p className="mt-1 pl-1 text-[11px] leading-4 text-muted-foreground">{help}</p>
 </div>;
}
function MiniStat({title,value,subtitle,Icon}:{title:string;value:number|null;subtitle:string;Icon:typeof BarChart3}){
 return <div className="report-exec-mini rounded-xl border border-border bg-background p-3">
  <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Icon className="h-4 w-4 text-primary"/>{title}</div>
  <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-foreground">{format(value)}</p>
  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{subtitle}</p>
 </div>;
}
export function ReportExecutiveDashboard(p:Props){
 const [selected,setSelected]=useState("todos");
 const [metric,setMetric]=useState<"carteira"|"atendimentos">("carteira");
 const [expanded,setExpanded]=useState(false);
 const people=useMemo(()=>[...p.equipe].sort((a,b)=>(metric==="carteira"?b.carteira-a.carteira:b.atendimentos-a.atendimentos)),[p.equipe,metric]);
 const visible=selected==="todos"?people:people.filter(x=>x.id===selected);
 const ranked=expanded?visible:visible.slice(0,5);
 const max=Math.max(1,...visible.map(x=>metric==="carteira"?x.carteira:x.atendimentos));
 const barTotal=Math.max(0,p.ativos||0)+Math.max(0,p.encerrados||0);
 const outros=Math.max(0,(p.total||0)-barTotal);
 const pieData=[
  {name:"Ativos",value:Math.max(0,p.ativos||0),color:colors[0]},
  {name:"Encerrados (CRM)",value:Math.max(0,p.encerrados||0),color:colors[1]},
  {name:"Outros estados",value:outros,color:colors[2]}
 ].filter(x=>x.value>0);
 const pathname=(periodo:string,meus=p.meus)=>"/report?periodo="+encodeURIComponent(periodo)+"&escopo="+(meus||!p.canViewTeam?"meus":"empresa");
 const notes=[
  {heading:"Retornos a conferir",body:p.semRetorno==null?"Consulta indisponível.":format(p.semRetorno)+" processos ativos sem retorno registrado há 30 dias ou mais.",Icon:Clock3},
  {heading:"Novidades na carteira",body:p.novidades==null?"Consulta indisponível.":format(p.novidades)+" processos com novidade no snapshot atual.",Icon:BellRing},
  {heading:"Mérito judicial",body:p.meritoPendente==null?"Consulta indisponível.":format(p.meritoPendente)+" classificações oficiais ainda a esclarecer; não são sentenças definitivas.",Icon:ShieldAlert}
 ];
 return <section data-lexis-report-executive aria-label="Painel executivo de relatórios" className="relative overflow-hidden rounded-[24px] border border-border bg-card p-3 text-foreground shadow-sm sm:p-5 xl:p-6">

  <div className="relative">
   <header className="flex flex-wrap items-start justify-between gap-4 pb-5">
    <div className="flex items-start gap-3">
     <span className="report-exec-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BarChart3 className="h-6 w-6 text-primary-foreground"/></span>
     <div><h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Relatórios operacionais</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">Desempenho operacional, carteira e auditoria jurídica num só lugar. Dados reais da carteira autorizada, sem estimativas.</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
     <Link className={linkClass} href="/processos"><BriefcaseBusiness className="h-4 w-4"/>Processos</Link>
     {p.canViewTeam && <Link className={linkClass} href="/report/completo"><FileText className="h-4 w-4"/>Relatório completo</Link>}
     {p.canExport && <ReportPdfExportButton periodo={p.periodo} escopo={p.meus?"meus":"empresa"} label="Exportar PDF" className="report-premium-button disabled:cursor-not-allowed disabled:opacity-50"/>}
    </div>
   </header>
   <nav aria-label="Filtros do relatório" className="report-exec-filters mb-4 grid gap-2 rounded-2xl border border-border bg-background p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
    <div><span className="mb-1 block text-[11px] text-muted-foreground">Período dos eventos</span><div className="flex flex-wrap gap-1">{([{id:"esta_semana",name:"Semana"},{id:"semana_passada",name:"Anterior"},{id:"mes",name:"Mês"}] as const).map(x=><Link key={x.id} aria-current={p.periodo===x.id?"page":undefined} href={pathname(x.id)} className={"rounded-lg px-2.5 py-2 text-xs font-semibold "+(p.periodo===x.id?"bg-primary text-primary-foreground":"bg-card text-foreground hover:bg-muted")}>{x.name}</Link>)}</div></div>
    <div><span className="mb-1 block text-[11px] text-muted-foreground">Escopo da carteira</span><div className="flex gap-1">{[{key:false,label:"Empresa"},{key:true,label:"Minha"}].filter(x=>p.canViewTeam||x.key).map(x=><Link key={String(x.key)} aria-current={p.meus===x.key?"page":undefined} href={pathname(p.periodo,x.key)} className={"rounded-lg px-3 py-2 text-xs font-semibold "+(p.meus===x.key?"bg-primary text-primary-foreground":"bg-card text-foreground hover:bg-muted")}>{x.label}</Link>)}</div></div>
    <label className="block text-[11px] text-muted-foreground">Responsável — painéis da equipe<select aria-label="Filtrar colaboradores nos painéis da equipe" className="mt-1 block h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground" value={selected} onChange={e=>setSelected(e.target.value)}><option value="todos">Todos os colaboradores</option>{people.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
    <label className="block text-[11px] text-muted-foreground">Comparar na equipe<select className="mt-1 block h-9 w-full rounded-lg border border-border bg-card px-2 text-xs text-foreground" value={metric} onChange={e=>setMetric(e.target.value as "carteira"|"atendimentos")}><option value="carteira">Carteira atribuída</option><option value="atendimentos">Registros de atendimento</option></select></label>
    <div className="flex flex-wrap items-end gap-2"><Link href={pathname("mes",!p.canViewTeam)} className={linkClass}><Filter className="h-4 w-4"/>Limpar</Link><Link href="/report" className={linkClass}><RefreshCw className="h-4 w-4"/>Atualizar</Link></div>
   </nav>
   <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-7">
    <Stat title="Carteira total" value={p.total} help="Snapshot atual" Icon={Wallet} tone="portfolio"/>
    <Stat title="Ativos" value={p.ativos} help="Status atual no CRM" Icon={Users} tone="active"/>
    <Stat title="Encerrados" value={p.encerrados} help="Encerrados no CRM, não mérito" Icon={CheckCircle2} tone="closed"/>
    <Stat title="Com novidade" value={p.novidades} help="Novidade identificada na carteira" Icon={MessageCircle} tone="updates"/>
    <Stat title="Sem retorno 30d+" value={p.semRetorno} help="Ativos com retorno antigo ou ausente" Icon={Clock3} tone="overdue"/>
    <Stat title="Atendimentos" value={p.eventos} help="Eventos registrados no período" Icon={Activity} tone="contacts"/>
    <Stat title="Atividades cadastradas" value={p.atividadesRegistradas} help={p.meus?"Total salvo por você · todas as datas":"Total salvo na empresa · todas as datas"} Icon={ClipboardList} tone="activities"/>
   </div>
   <div className="grid gap-3 lg:grid-cols-12">
    <div className={panel+" p-4 lg:col-span-6"}>
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><BarChart3 className="h-4 w-4 text-primary"/>Evolução de Atendimentos e Encerramentos</h2><span className="text-[11px] text-muted-foreground">Por dia · {p.periodo==="mes"?"mês atual":p.periodo==="esta_semana"?"esta semana":"semana passada"}</span></div>
     {p.dias.length?<div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={p.dias} margin={{top:8,right:10,bottom:0,left:-25}}><CartesianGrid stroke="var(--lx-report-line)" strokeDasharray="3 5"/><XAxis dataKey="ymd" tickFormatter={v=>String(v).slice(8,10)+"/"+String(v).slice(5,7)} tick={{fontSize:10,fill:"var(--lx-report-muted)"}} minTickGap={16}/><YAxis allowDecimals={false} tick={{fontSize:10,fill:"var(--lx-report-muted)"}}/><Tooltip contentStyle={{background:"var(--lx-report-paper)",border:"1px solid var(--lx-report-line)",borderRadius:12,color:"var(--lx-report-ink)"}} labelFormatter={v=>String(v).split("-").reverse().join("/")}/><Line type="monotone" name="Atendimentos" dataKey="atendimentos" stroke="var(--lx-report-chart-1)" strokeWidth={3} dot={false} activeDot={{r:5}}/><Line type="monotone" name="Encerramentos manuais" dataKey="encerramentos" stroke="var(--lx-report-chart-2)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>:<div className="flex h-[230px] items-center justify-center text-sm text-muted-foreground">Série diária indisponível nesta consulta.</div>}
     <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-muted-foreground"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-primary"/>Atendimentos</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--lx-report-chart-2)]"/>Encerramentos manuais</span></div>
    </div>
    <div className={panel+" p-4 lg:col-span-3"}>
     <div className="mb-4 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Users className="h-4 w-4 text-primary"/>Carteira por Responsável</h2><button onClick={()=>setExpanded(!expanded)} className="text-[11px] text-primary hover:underline">{expanded?"Menos":"Ver todos"}</button></div>
     <div className="space-y-3">{ranked.map((x,i)=><div key={x.id} className="grid grid-cols-[minmax(0,6rem)_1fr_auto] items-center gap-2 text-xs"><span className="truncate text-foreground" title={x.nome}>{x.nome}</span><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:Math.max(2,100*(metric==="carteira"?x.carteira:x.atendimentos)/max)+"%",background:colors[i%colors.length]}}/></div><span className="w-9 text-right font-bold tabular-nums text-foreground">{format(metric==="carteira"?x.carteira:x.atendimentos)}</span></div>)}</div>
     {!ranked.length?<p className="mt-6 text-xs text-muted-foreground">Dados da equipe indisponíveis.</p>:null}
     <p className="mt-4 text-[11px] text-muted-foreground">{metric==="carteira"?"Processos atribuídos atualmente; não representam trabalho executado.":"Eventos de atendimento registrados por usuário no período."}</p>
    </div>
    <div className={panel+" p-4 lg:col-span-3"}>
     <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><BriefcaseBusiness className="h-4 w-4 text-primary"/>Distribuição da Carteira</h2>
     {p.total!=null&&p.total>0?<div className="relative mx-auto mt-2 h-[182px] max-w-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={58} outerRadius={81} stroke="none">{pieData.map(x=><Cell key={x.name} fill={x.color}/>)}</Pie><Tooltip formatter={value=>format(Number(value))} contentStyle={{background:"var(--lx-report-paper)",border:"1px solid var(--lx-report-line)",borderRadius:12,color:"var(--lx-report-ink)"}}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black text-foreground">{format(p.total)}</span><span className="text-[10px] text-muted-foreground">processos</span></div></div>:<p className="mt-8 text-sm text-muted-foreground">Distribuição indisponível.</p>}
     <div className="mt-2 grid grid-cols-1 gap-2 text-[11px]">{pieData.map(x=><div key={x.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{background:x.color}}/>{x.name}</span><b className="tabular-nums text-foreground">{format(x.value)}</b></div>)}</div>
     <p className="mt-2 text-[10px] text-muted-foreground">O agrupamento por escritório permanece no relatório detalhado; este gráfico utiliza status confirmados no snapshot.</p>
    </div>
   </div>
   <div className="mt-3 grid gap-3 lg:grid-cols-12">
    <section className={panel+" p-4 lg:col-span-4"}><div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-primary"/>Auditoria e Risco</h2><Link className="text-[11px] text-primary hover:underline" href="/analises-internas">Ver auditorias</Link></div><div className="grid grid-cols-2 gap-2"><MiniStat title="Vencidos CRM" value={p.vencidos} subtitle="Classificação cadastral" Icon={AlertTriangle}/><MiniStat title="Mérito a esclarecer" value={p.meritoPendente} subtitle="Não é sentença final" Icon={ShieldAlert}/></div><Link href="/tarefas" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver pendências operacionais <ChevronRight className="h-3.5 w-3.5"/></Link></section>
    <section className={panel+" p-4 lg:col-span-4"}><div className="mb-3 flex justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary"/>Produtividade da Equipe</h2><a href="#equipe" className="text-[11px] text-primary hover:underline">Detalhes</a></div><div className="overflow-x-auto"><table className="w-full min-w-[350px] text-left text-[11px]"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-2 py-2">Responsável</th><th className="px-2">Carteira</th><th className="px-2">Atend.</th><th className="px-2">Encerr.</th><th className="px-2">Edições</th></tr></thead><tbody>{ranked.map(x=><tr key={x.id} className="border-b border-border text-foreground"><td className="max-w-24 truncate px-2 py-2 font-semibold" title={x.nome}>{x.nome}</td><td className="px-2 tabular-nums">{format(x.carteira)}</td><td className="px-2 tabular-nums">{format(x.atendimentos)}</td><td className="px-2 tabular-nums">{format(x.encerramentos)}</td><td className="px-2 tabular-nums">{format(x.edicoes)}</td></tr>)}</tbody></table></div>{!ranked.length?<p className="mt-4 text-xs text-muted-foreground">Sem dados de colaboradores nesta consulta.</p>:null}<p className="mt-3 text-[10px] text-muted-foreground">Atendimentos, edições e encerramentos representam registros atribuídos ao executor no período.</p></section>
    <section className={panel+" p-4 lg:col-span-2"}><div className="mb-3 flex justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-primary"/>WhatsApp e Atendimento</h2></div><div className="grid grid-cols-2 gap-2"><MiniStat title="Atendidos" value={p.atendidos} subtitle="Processos distintos" Icon={Users}/></div><Link href="/whatsapp" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">Abrir WhatsApp <ChevronRight className="h-3.5 w-3.5"/></Link></section>
    <section className={panel+" p-4 lg:col-span-2"}><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-primary"/>Pontos de atenção</h2><div className="space-y-3">{notes.map(x=><div key={x.heading} className="flex gap-2 border-b border-border pb-2"><x.Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><p className="text-[11px] font-semibold text-foreground">{x.heading}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{x.body}</p></div></div>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Insights determinísticos, sem IA externa ou alegações inventadas.</p></section>
   </div>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>Dados da última consulta ao Supabase · indicadores de carteira são atuais; ações são do período escolhido.</span><Link href="/report/completo" className="inline-flex items-center gap-1 text-primary">Abrir relatórios completos <ArrowUpRight className="h-3.5 w-3.5"/></Link></div>
  </div>
 </section>;
}
