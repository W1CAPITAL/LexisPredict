import Link from "next/link";
import {redirect} from "next/navigation";
import {getUserContext,getSupabaseAdmin} from "@/lib/server-db";
import {getHistoricoAtendimentosEmpresa,type AtendimentosHistorico} from "@/lib/historico-atendimentos";
import type {PeriodoRelatorio} from "@/lib/atendimento-semana";

export const dynamic="force-dynamic";
export const revalidate=0;
const choices=[
 {id:"esta_semana",name:"Esta semana"},
 {id:"semana_passada",name:"Semana passada"},
 {id:"mes",name:"Mês atual"},
] as const;
const br=(ymd:string)=>ymd?ymd.slice(8,10)+"/"+ymd.slice(5,7):"";
const fmt=(num:number|null|undefined)=>num==null?"—":num.toLocaleString("pt-BR");
export default async function ReportPage({searchParams}:{searchParams:Promise<{periodo?:string}>}){
 const params=await searchParams;
 const periodo:PeriodoRelatorio=params.periodo==="semana_passada"?"semana_passada":params.periodo==="mes"?"mes":"esta_semana";
 const ctx=await getUserContext();
 if(!ctx.empresa_id||!ctx.auth_id)redirect("/login");
 const empresaId=String(ctx.empresa_id);
 const owner=(ctx.isSupervisor||ctx.isSuperAdmin||ctx.caseScope==="empresa")?null:ctx.auth_id;
 const [historyResult,snapshotResult]=await Promise.allSettled([
  getHistoricoAtendimentosEmpresa(empresaId,periodo),
  (async()=>{const db=await getSupabaseAdmin();return db.rpc("lexis_portfolio_snapshot",{p_empresa:empresaId,p_owner:owner});})(),
 ]);
 const hist:AtendimentosHistorico|null=historyResult.status==="fulfilled"?historyResult.value:null;
 const res=snapshotResult.status==="fulfilled"?snapshotResult.value:null;
 const row=Array.isArray(res?.data)?res.data[0]:null;
 const snapshot=res&&!res.error&&row?{
   total:Number(row.total||0),ativos:Number(row.ativos||0),encerrados:Number(row.encerrados||0),
   vencidos:Number(row.vencidos||0),novidades:Number(row.novidades||0),baixas:Number(row.baixas||0)
 }:null;
 const totals=[
  {title:"Processos atendidos",value:hist?.processos,help:"Distintos no período, empresa inteira"},
  {title:"Atendimentos registrados",value:hist?.eventos,help:"Eventos feitos por pessoas"},
  {title:"Processos editados",value:hist?.edicoes?.processos,help:"Edições manuais, sem duplicações"},
  {title:"Editados hoje",value:hist?.edicoes?.hoje,help:"Processos com edição registrada hoje"},
 ];
 const carteira=[
   {title:"Carteira",value:snapshot?.total},
   {title:"Ativos",value:snapshot?.ativos},
   {title:"Encerrados",value:snapshot?.encerrados},
   {title:"Vencidos",value:snapshot?.vencidos},
   {title:"Novidades",value:snapshot?.novidades},
   {title:"Baixas tribunal",value:snapshot?.baixas},
 ];
 return <main className="min-h-screen bg-background px-4 py-7 text-foreground sm:px-8">
   <div className="mx-auto max-w-[1400px] space-y-6">
    <header className="rounded-3xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">LexisPredict · Relatórios</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Resumo da equipe</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Dados diretamente do histórico do Supabase, sem aguardar o carregamento da carteira. Atendimentos de clientes de outros responsáveis contam para quem realizou o trabalho.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/minhas-atividades" className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold">Minhas atividades</Link>
          <Link href="/report/completo" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Relatório completo e PDFs</Link>
        </div>
      </div>
      <nav aria-label="Selecionar período" className="mt-5 flex flex-wrap gap-2">
        {choices.map(x=><Link key={x.id} href={`/report?periodo=${x.id}`}
          aria-current={periodo===x.id?"page":undefined}
          className={`rounded-full border px-4 py-2 text-xs font-bold ${periodo===x.id?"border-primary bg-primary text-primary-foreground":"border-border bg-background text-foreground hover:bg-muted"}`}>{x.name}</Link>)}
      </nav>
    </header>
    <section aria-labelledby="kpi-title" className="space-y-3">
      <h2 id="kpi-title" className="text-lg font-bold">Atendimentos e produtividade</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map(c=><div key={c.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">{c.title}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{fmt(c.value)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{c.help}</p>
        </div>)}
      </div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Atendimentos por dia</h2>
        <p className="mt-1 text-xs text-muted-foreground">Um processo conta uma vez em cada dia de atendimento, mesmo que tenha vários registros no mesmo dia.</p>
        {hist?<div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {hist.dias.map(d=><div key={d.ymd} className="rounded-xl border border-border bg-background p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground">{periodo==="mes"?br(d.ymd):d.day}</p>
            <p className="mt-1 text-xl font-black tabular-nums">{d.atendimentos}</p>
            {periodo!=="mes"?<p className="text-[10px] text-muted-foreground">{br(d.ymd)}</p>:null}
          </div>)}
        </div>:<p className="mt-5 text-sm text-muted-foreground">Não foi possível consultar o histórico neste momento. Nenhum número provisório foi usado.</p>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Por colaborador</h2>
        <p className="mt-1 text-xs text-muted-foreground">Crédito para o executor do atendimento, independentemente da carteira.</p>
        <div className="mt-4 space-y-2">
          {hist?.porUsuario.length?hist.porUsuario.map(x=><div key={x.userId} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <span className="text-sm font-semibold">{x.nome}</span>
            <span className="text-right text-sm tabular-nums"><strong>{x.processos}</strong> processos <span className="text-muted-foreground">· {x.eventos} registros</span></span>
          </div>):<p className="text-sm text-muted-foreground">Não há atendimentos pessoais confirmados para o período consultado.</p>}
        </div>
        {hist?.tecnicoEventos?<p className="mt-3 text-xs text-muted-foreground">{hist.tecnicoEventos} eventos de contas técnicas mantidos fora da contagem humana.</p>:null}
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">Visão da carteira</h2><p className="mt-1 text-xs text-muted-foreground">Totais consultados diretamente no banco, sem baixar cada processo.</p></div>
        <Link href="/processos" className="text-sm font-semibold text-primary underline">Abrir processos da empresa</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {carteira.map(c=><div key={c.title} className="rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{c.title}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(c.value)}</p>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Escopo: {owner?"processos do usuário logado":"carteira completa da empresa"}. Contagens de andamento e encerramento não devem ser confundidas com atendimentos.</p>
    </section>
    <div className="flex flex-wrap gap-3">
      <Link href="/report/completo" className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Abrir relatório detalhado, parecer e PDFs</Link>
      <Link href="/analises-internas" className="inline-flex rounded-xl border border-border px-5 py-3 text-sm font-bold">Ver análises e auditorias</Link>
    </div>
    <p className="pb-4 text-xs text-muted-foreground">O histórico diferencia processos distintos, registros repetidos, edições e operações de contas técnicas. Os números refletem a consulta mais recente e podem crescer ao longo do dia.</p>
   </div>
 </main>;
}
