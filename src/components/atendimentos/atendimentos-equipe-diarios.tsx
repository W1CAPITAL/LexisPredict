"use client";

import {Activity, BarChart3, CalendarDays, Clock3, FileCheck2, UsersRound} from "lucide-react";
import type {ReactNode} from "react";
import type {AtendimentosHistorico} from "@/lib/historico-atendimentos";
import {cn} from "@/lib/utils";

type Props={
  historico:AtendimentosHistorico|null|undefined;
  variant?:"full"|"today";
  className?:string;
};

type SummaryColor="blue"|"violet"|"amber"|"green";
const metricColors:Record<SummaryColor,{icon:string;ring:string}>={
  blue:{icon:"bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",ring:"hover:border-sky-300/70"},
  violet:{icon:"bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",ring:"hover:border-violet-300/70"},
  amber:{icon:"bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",ring:"hover:border-amber-300/70"},
  green:{icon:"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",ring:"hover:border-emerald-300/70"},
};
const personStyles=[
  {avatar:"bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",bar:"bg-sky-500",number:"text-sky-800 dark:text-sky-300"},
  {avatar:"bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",bar:"bg-violet-500",number:"text-violet-800 dark:text-violet-300"},
  {avatar:"bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",bar:"bg-amber-500",number:"text-amber-800 dark:text-amber-300"},
  {avatar:"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",bar:"bg-emerald-500",number:"text-emerald-800 dark:text-emerald-300"},
] as const;
const nf=(n:number)=>n.toLocaleString("pt-BR");
const fmtDay=(ymd:string)=>ymd.slice(8,10)+"/"+ymd.slice(5,7);
const initials=(name:string)=>name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toLocaleUpperCase("pt-BR");

function Metric({
  label,value,description,icon,color="blue"
}:{
  label:string;value:number;description:string;icon:ReactNode;color?:SummaryColor
}){
  const theme=metricColors[color];
  return <div className={cn(
    "group min-w-0 rounded-2xl border border-border/75 bg-card/90 p-3.5 shadow-sm transition-colors sm:p-4",
    theme.ring
  )}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-muted-foreground">{label}</span>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",theme.icon)}>
        {icon}
      </span>
    </div>
    <div className="mt-1 text-[clamp(1.7rem,2vw,2.15rem)] font-black leading-none tracking-tight text-foreground tabular-nums">
      {nf(value)}
    </div>
    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{description}</p>
  </div>;
}

/**
 * As quatro telas reutilizam a mesma consulta agregada do Supabase.
 * Contagem = CNJ distinto por executor por dia; não inferir contatos de edições.
 * Ocultar colaborador/dia com zero, preservar status e lógica de negócio.
 */
export function AtendimentosEquipeDiarios({historico,variant="full",className=""}:Props){
  const isFull=variant==="full";
  const data=(historico?.porUsuarioDia||[]).filter(x=>x.processos>0);
  const ymdToday=historico?.hoje||
    new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const today=data.filter(x=>x.ymd===ymdToday).sort(
    (a,b)=>b.processos-a.processos||a.nome.localeCompare(b.nome,"pt-BR")
  );
  const dates=[...new Set(data.map(x=>x.ymd))].sort().reverse();
  const people=new Map<string,{userId:string;nome:string;total:number}>();
  for(const item of data){
    const previous=people.get(item.userId);
    if(previous)previous.total+=item.processos;
    else people.set(item.userId,{userId:item.userId,nome:item.nome,total:item.processos});
  }
  const rows=[...people.values()].filter(x=>x.total>0).sort(
    (a,b)=>b.total-a.total||a.nome.localeCompare(b.nome,"pt-BR")
  );
  const byKey=new Map(data.map(x=>[x.userId+"|"+x.ymd,x]));
  const todayProcesses=today.reduce((sum,x)=>sum+x.processos,0);
  const todayEvents=today.reduce((sum,x)=>sum+x.eventos,0);
  const sumOfDailyWork=rows.reduce((sum,x)=>sum+x.total,0);
  const maxToday=Math.max(1,...today.map(x=>x.processos));
  const updatedTime=historico?.atualizadoEm?new Date(historico.atualizadoEm):null;
  const updatedLabel=updatedTime&&!Number.isNaN(updatedTime.getTime())?
    updatedTime.toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}):null;

  return <section aria-label={isFull?"Atendimentos por colaborador e dia":"Atendimentos de hoje"} className={cn(
    "overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm",
    className
  )}>
    <div className="border-b border-border/60 bg-gradient-to-r from-card via-card to-muted/30 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
            <BarChart3 size={20} aria-hidden="true"/>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black tracking-tight text-foreground sm:text-lg">
              {isFull?"Atendimentos por colaborador e dia":"Atendimentos de hoje"}
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-4 text-muted-foreground">
              Processos distintos por executor. Atendimentos repetidos do mesmo CNJ no dia não duplicam a contagem.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            <CalendarDays size={12} aria-hidden="true"/> {fmtDay(ymdToday)}
          </span>
          {updatedLabel&&<span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Clock3 size={12} aria-hidden="true"/> Supabase {updatedLabel}
          </span>}
        </div>
      </div>
    </div>

    {!historico?<div className="px-5 py-6 text-sm text-muted-foreground">
      Histórico indisponível nesta consulta. Os valores anteriores não foram substituídos por estimativas.
    </div>:<div className="space-y-5 p-4 sm:p-5">
      <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-3",isFull?"xl:grid-cols-4":"lg:grid-cols-3")}>
        <Metric label="Atendidos hoje" value={todayProcesses} description="Soma dos processos de cada executor" icon={<FileCheck2 size={17}/>} color="blue"/>
        <Metric label="Equipe hoje" value={today.length} description="Somente colaboradores com atendimento" icon={<UsersRound size={17}/>} color="green"/>
        <Metric label="Registros hoje" value={todayEvents} description="Eventos auditados, separados dos CNJs" icon={<Activity size={17}/>} color="amber"/>
        {isFull&&<Metric label="Soma diária do período" value={sumOfDailyWork} description="Um CNJ por pessoa e dia; não é o total de CNJs únicos" icon={<BarChart3 size={17}/>} color="violet"/>}
      </div>

      {(variant==="today"||historico.periodo==="esta_semana"||historico.periodo==="mes")&&
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-[.13em] text-muted-foreground">
              Equipe com atendimento hoje
            </h3>
            {today.length>0&&<span className="text-[11px] font-semibold text-muted-foreground">
              {fmtDay(ymdToday)} · {nf(todayProcesses)} processo(s)
            </span>}
          </div>
          {today.length?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {today.map((item,i)=>{
              const theme=personStyles[i%personStyles.length];
              const share=Math.max(0,Math.min(100,item.processos/maxToday*100));
              return <div key={item.userId} className="rounded-2xl border border-border/75 bg-background/90 p-4 shadow-sm transition-colors hover:border-primary/30">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black",theme.avatar)} aria-hidden="true">
                    {initials(item.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Colaborador</p>
                    <p className="truncate text-sm font-extrabold text-foreground" title={item.nome}>{item.nome}</p>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-3xl font-black leading-none tabular-nums",theme.number)}>{nf(item.processos)}</div>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">processos</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full",theme.bar)} style={{width:share+"%"}} aria-hidden="true"/>
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>{nf(item.eventos)} registro(s)</span>
                  <span>Hoje · {fmtDay(ymdToday)}</span>
                </div>
              </div>;
            })}
          </div>:<div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
            Nenhum atendimento humano registrado hoje.
          </div>}
        </div>}

      {isFull&&<div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-[.13em] text-muted-foreground">Distribuição diária</h3>
          <span className="rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            {nf(rows.length)} colaborador(es) com atendimento no período
          </span>
        </div>
        {rows.length>0&&dates.length>0?
          <div className="overflow-x-auto rounded-xl border border-border/75" role="region" aria-label="Tabela diária por colaborador">
            <table className="w-full min-w-[580px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th scope="col" className="sticky left-0 z-20 min-w-[185px] border-b border-border bg-muted px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground sm:min-w-[210px]">
                    Colaborador
                  </th>
                  {dates.map(date=><th key={date} scope="col" className="min-w-[72px] border-b border-border px-2 py-3 text-center text-[11px] font-extrabold">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1",date===ymdToday?"bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200":"bg-background/80 text-muted-foreground")}>
                      {fmtDay(date)}
                    </span>
                  </th>)}
                  <th scope="col" className="min-w-[98px] border-b border-border px-3 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Soma diária</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user,index)=>{
                  const theme=personStyles[index%personStyles.length];
                  return <tr key={user.userId} className="group hover:bg-muted/15">
                    <th scope="row" className="sticky left-0 z-10 border-b border-border/50 bg-card px-3 py-3 text-left group-hover:bg-muted/20">
                      <div className="flex items-center gap-2">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black",theme.avatar)} aria-hidden="true">{initials(user.nome)}</span>
                        <span className="min-w-0 break-words text-xs font-extrabold text-foreground">{user.nome}</span>
                      </div>
                    </th>
                    {dates.map(date=>{
                      const item=byKey.get(user.userId+"|"+date);
                      return <td key={date} className={cn("border-b border-border/50 px-2 py-3 text-center tabular-nums",date===ymdToday&&"bg-sky-50/30 dark:bg-sky-950/10")}>
                        {item&&item.processos>0?
                          <span title={nf(item.eventos)+" registros; "+nf(item.encerramentos)+" encerramentos manuais"} className={cn("inline-flex min-w-10 justify-center rounded-lg border px-2 py-1 text-xs font-black",date===ymdToday?"border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200":"border-border/70 bg-muted/45 text-foreground")}>
                            {nf(item.processos)}
                          </span>:
                          <span className="text-muted-foreground/40">—</span>}
                      </td>;
                    })}
                    <td className="border-b border-border/50 px-3 py-3 text-right">
                      <span className="inline-flex min-w-12 justify-center rounded-lg border border-emerald-200/80 bg-emerald-50 px-2 py-1 text-xs font-black tabular-nums text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {nf(user.total)}
                      </span>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>:
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">Nenhum atendimento humano registrado no período.</p>}
      </div>}
      {isFull&&<p className="border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground">
        Um CNJ conta uma vez por colaborador por dia. O mesmo processo atendido em dias diferentes soma em ambos, por isso a soma diária pode superar os CNJs únicos do período. Inclui atendimento e encerramento manual auditados; exclui testes, importações, edições isoladas e contas técnicas. Colaboradores sem atendimento ficam ocultos.
      </p>}
    </div>}
  </section>;
}
