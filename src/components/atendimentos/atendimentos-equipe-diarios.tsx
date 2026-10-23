"use client";

import type {AtendimentosHistorico} from "@/lib/historico-atendimentos";

type Props={
 historico:AtendimentosHistorico|null|undefined;
 variant?:"full"|"today";
 className?:string;
};
/**
 * Fonte única: lexis_atividade_kpis_periodo -> porUsuarioDia.
 * Um CNJ por executor/dia; não soma log duplicado como processo.
 * Não mostra operadores sem atendimento ou colunas de datas totalmente zeradas.
 */
export function AtendimentosEquipeDiarios({historico,variant="full",className=""}:Props){
 const data=(historico?.porUsuarioDia||[]).filter(x=>x.processos>0);
 const ymdToday=historico?.hoje||
  new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const today=data.filter(x=>x.ymd===ymdToday).sort((a,b)=>b.processos-a.processos||a.nome.localeCompare(b.nome,"pt-BR"));
 const title=variant==="today"?"Atendimentos de hoje":"Atendimentos por colaborador e dia";
 const number=(n:number)=>n.toLocaleString("pt-BR");
 const fmtDay=(date:string)=>date.slice(8,10)+"/"+date.slice(5,7);
 const dates=[...new Set(data.map(x=>x.ymd))].sort().reverse();
 const people=new Map<string,{userId:string;nome:string;total:number}>();
 for(const x of data){
   const old=people.get(x.userId);
   if(old)old.total+=x.processos;
   else people.set(x.userId,{userId:x.userId,nome:x.nome,total:x.processos});
 }
 const rows=[...people.values()].filter(x=>x.total>0).sort((a,b)=>b.total-a.total||a.nome.localeCompare(b.nome,"pt-BR"));
 const byKey=new Map(data.map(x=>[x.userId+"|"+x.ymd,x]));
 return <section className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm ${className}`} aria-label={title}>
  <div className="flex flex-wrap justify-between gap-2">
   <div>
    <h2 className="text-base font-extrabold">{title}</h2>
    <p className="mt-1 text-xs text-muted-foreground">Processos distintos por executor e dia · registros duplicados do mesmo CNJ não aumentam o número.</p>
   </div>
   {historico?.atualizadoEm?<span className="text-[11px] text-muted-foreground">Supabase · atualizado {new Date(historico.atualizadoEm).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"})}</span>:null}
  </div>
  {!historico?<p className="mt-4 text-sm text-muted-foreground">Não foi possível consultar os atendimentos agora.</p>:<>
   {(variant==="today"||historico.periodo==="esta_semana"||historico.periodo==="mes")&&<div className="mt-4">
    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hoje · {fmtDay(ymdToday)}</h3>
    {today.length?<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
     {today.map(x=><div key={x.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <span className="min-w-0 truncate text-sm font-semibold" title={x.nome}>{x.nome}</span>
      <div className="shrink-0 text-right">
       <strong className="text-xl tabular-nums">{number(x.processos)}</strong>
       <span className="ml-1 text-xs text-muted-foreground">processos</span>
       {x.eventos!==x.processos?<p className="text-[11px] text-muted-foreground">{number(x.eventos)} registros</p>:null}
      </div>
     </div>)}
    </div>:<p className="mt-2 text-xs text-muted-foreground">Nenhum atendimento humano registrado hoje.</p>}
   </div>}
   {variant==="full"&&<div className="mt-5">
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Distribuição diária · período selecionado</h3>
    {rows.length&&dates.length?<div className="overflow-x-auto rounded-xl border border-border" role="region" aria-label="Tabela de atendimentos por colaborador e data">
     <table className="w-full min-w-[420px] text-sm">
      <thead className="bg-muted/50">
       <tr><th scope="col" className="sticky left-0 z-10 min-w-[170px] bg-muted px-3 py-2 text-left text-xs font-bold">Colaborador</th>
        {dates.map(date=><th scope="col" key={date} className="min-w-[66px] px-2 py-2 text-center text-xs font-bold">{fmtDay(date)}</th>)}
        <th scope="col" className="px-3 py-2 text-right text-xs font-bold">Soma diária</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-border">
       {rows.map(u=><tr key={u.userId} className="hover:bg-muted/30">
        <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-semibold">{u.nome}</th>
        {dates.map(date=>{
          const x=byKey.get(u.userId+"|"+date);
          return <td key={date} className="px-2 py-2 text-center tabular-nums">
           {x&&x.processos>0?<span title={`${x.eventos} registros no dia; ${x.encerramentos} ações de encerramento`} className="font-bold">{number(x.processos)}</span>:<span className="text-muted-foreground/30">—</span>}
          </td>;
        })}
        <td className="px-3 py-2 text-right font-extrabold tabular-nums">{number(u.total)}</td>
       </tr>)}
      </tbody>
     </table>
    </div>:<p className="text-sm text-muted-foreground">Nenhum atendimento humano registrado no período.</p>}
    <p className="mt-2 text-[11px] text-muted-foreground">“Soma diária” conta cada CNJ uma vez por colaborador por dia; o mesmo processo em dias diferentes conta em ambos. O total de CNJs únicos no período pode ser menor. Inclui registros de atendimento e encerramento manual; exclui testes, edições isoladas e contas técnicas. Colaboradores e dias sem atendimento ficam ocultos.</p>
   </div>}
  </>}
 </section>;
}
