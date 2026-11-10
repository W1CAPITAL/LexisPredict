import Link from 'next/link';
import type {ReactNode} from 'react';
import {AlertTriangle,Activity,FileSearch,RefreshCw} from 'lucide-react';
import {normalizeHermesDiagnostics,type HermesPortfolioDiagnostics} from '@/lib/hermes-diagnostics-policy';

const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const date=(d:string|null|undefined)=>d&&/^\d{4}-\d{2}-\d{2}/.test(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'Não cadastrada';
function Numeric({title,value,note}:{title:string;value:number|string;note?:string}){
 return <div className="rounded-xl border border-border bg-muted/30 p-3">
  <p className="text-[11px] font-semibold text-muted-foreground">{title}</p>
  <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{typeof value==='number'?fmt(value):value}</p>
  {note&&<p className="mt-1 text-[11px] leading-5 text-muted-foreground">{note}</p>}
 </div>;
}
const th='border-b border-border px-3 py-2 text-left font-bold text-foreground';
const td='border-b border-border/60 px-3 py-2 text-foreground';
function Section({title,detail,children,defaultOpen=false}:{
 title:string;detail:string;children:ReactNode;defaultOpen?:boolean;
}){
 return <details open={defaultOpen||undefined} className="group rounded-xl border border-border bg-background p-3">
  <summary className="cursor-pointer text-sm font-bold text-foreground">{title}</summary>
  <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
  <div className="mt-3">{children}</div>
 </details>;
}
export function HermesPortfolioReport({data,compact=false}:{
 data:HermesPortfolioDiagnostics|null;compact?:boolean;
}){
 if(!data)return <section className="rounded-2xl border border-border bg-card p-4">
  <p className="flex items-center gap-2 font-bold"><Activity size={17}/> Auditoria detalhada Hermes</p>
  <p className="mt-1 text-xs text-muted-foreground">Ainda não há snapshot autorizado nesta empresa.</p>
 </section>;
 const d=normalizeHermesDiagnostics(data);
 return <section id="hermes-deep-report" className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Relatório detalhado de saúde operacional Hermes">
   <header className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-primary"><Activity size={15}/> Hermes · inteligência operacional auditada</p>
     <h2 className="mt-1 text-lg font-black text-foreground">Falhas, saúde, criticidade e trabalho por responsável</h2>
     <p className="mt-1 text-xs leading-5 text-muted-foreground">
      Consolidado de {date(d.day)} · {fmt(d.active)} processos abertos · {fmt(d.closed)} encerrados no CRM.
      Saúde é qualidade do acompanhamento cadastrado, nunca chance de vitória/derrota judicial.
     </p>
    </div>
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw size={14}/> Atualização automática periódica</p>
   </header>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
    <Numeric title="Saúde operacional média" value={d.averageHealth+'/100'} note="Dos casos abertos"/>
    <Numeric title="Retornos vencidos ativos" value={d.overdueReturns} note="Não é prazo judicial"/>
    <Numeric title="Datas de prazo a conferir" value={d.registeredDeadlinesDue} note="Campo do CRM; não confirma prazo judicial perdido"/>
    <Numeric title="Fontes desatualizadas" value={d.staleSources} note="Conferir DJEN/DataJud"/>
    <Numeric title="Tarefas operacionais abertas" value={d.openCrmTasks} note="Não são retornos vencidos"/>
    <Numeric title="Atenção / Crítica" value={d.attention+' / '+d.critical} note="Classificação operacional"/>
   </div>

   <div className={compact?'grid gap-3':'grid gap-3 lg:grid-cols-2'}>
    <Section defaultOpen title="Resultados cadastrados · procedência, improcedência e parciais"
      detail="Indícios explícitos nas justificativas. Não confirmam trânsito em julgado nem sentença definitiva.">
     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Numeric title="Improcedência indicada" value={d.merits.improcedenteIndicada}/>
      <Numeric title="Procedência indicada" value={d.merits.procedenteIndicada}/>
      <Numeric title="Procedência parcial indicada" value={d.merits.parcialIndicada}/>
      <Numeric title="Mérito não determinável" value={d.merits.indeterminado}/>
      <Numeric title="Flag sem justificativa conclusiva" value={d.merits.flagWithoutEvidence}/>
      <Numeric title="Falhas históricas de consulta" value={d.sourceErrors} note="Não provam ausência de andamento"/>
     </div>
     <p className="mt-3 text-xs text-muted-foreground">Os movimentos oficiais (TPU) continuam separados no relatório judicial. Não se calcula taxa de sucesso por advogado a partir dessas flags.</p>
    </Section>
    <Section defaultOpen title="Riscos e lacunas de acompanhamento"
      detail="Pendências administrativas observadas e campos que precisam de confirmação das fontes.">
     <div className="grid grid-cols-2 gap-2">
      <Numeric title="Sem advogado identificado" value={d.missingLawyer}/>
      <Numeric title="Sem escritório identificado" value={d.missingOffice}/>
      <Numeric title="Atividades cadastradas (30 dias)" value={d.completedHumanTasks30d}/>
      <Numeric title="Contatos confirmados (30 dias)" value={d.contactsConfirmed30d}/>
      <Numeric title="Tarefas sem vínculo na equipe" value={d.unmatchedAssigneeTasks||0} note="IDs sem correspondência com usuários atuais"/>
      <Numeric title="Datas de retorno inconsistentes" value={d.invalidReturnDates||0} note="Não são retornos vencidos"/>
     </div>
     <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-foreground">
      <strong>Datas a validar:</strong> {fmt(d.registeredDeadlinesDue)} processos abertos com campo de prazo antigo. Não significa que esses prazos estejam vigentes ou perdidos.
     </p>
    </Section>
   </div>
   <Section title={'Criticidade e saúde por advogado · '+fmt(d.byLawyer.length)+' categorias'}
    detail="Risco da carteira atribuída e cobertura das fontes; não mede competência ou taxa de êxito do profissional.">
    <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
     <table className="w-full border-collapse text-left text-xs"><thead><tr>{['Advogado','Abertos / total','Críticos / vencidos','Fontes desatualizadas','Saúde média'].map(x=><th className={th} key={x}>{x}</th>)}</tr></thead>
      <tbody>{d.byLawyer.map((x,i)=><tr key={i}><td className={td}>{x.name}</td><td className={td}>{x.active} / {x.total}</td><td className={td}>{x.critical} / {x.overdue}</td><td className={td}>{x.sourceGaps}</td><td className={td}>{x.avgHealth}/100</td></tr>)}</tbody></table>
    </div>
   </Section>
   <Section title={'Riscos e produtividade por escritório · '+fmt(d.byOffice.length)+' grupos'}
    detail="Distribuição e saúde por escritório; uma carteira maior não significa desempenho pior.">
    <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
     <table className="w-full border-collapse text-left text-xs"><thead><tr>{['Escritório','Abertos / total','Críticos / vencidos','Fontes desatualizadas','Saúde'].map(x=><th className={th} key={x}>{x}</th>)}</tr></thead>
      <tbody>{d.byOffice.map((x,i)=><tr key={i}><td className={td}>{x.name}</td><td className={td}>{x.active} / {x.total}</td><td className={td}>{x.critical} / {x.overdue}</td><td className={td}>{x.sourceGaps}</td><td className={td}>{x.avgHealth}/100</td></tr>)}</tbody></table>
    </div>
   </Section>
   <Section title={'Produtividade individual e da equipe · '+fmt(d.byUser.length)+' colaboradores'}
    detail="Registros de 30 dias podem incluir importações e rotinas automáticas. Contatos confirmados são contabilizados separadamente; quantidade não mede horas ou desempenho.">
    <div className="overflow-auto rounded-lg border border-border">
     <table className="w-full border-collapse text-left text-xs"><thead><tr>{['Colaborador / cargo','Registros 30d','Contatos confirmados','Processos distintos','Tarefas abertas'].map(x=><th className={th} key={x}>{x}</th>)}</tr></thead>
      <tbody>{d.byUser.map((x,i)=><tr key={i}><td className={td}><strong>{x.name}</strong><span className="block text-[11px] text-muted-foreground">{x.role}</span></td><td className={td}>{x.done30d}</td><td className={td}>{x.contacts30d}</td><td className={td}>{x.distinctCases}</td><td className={td}>{x.openTasks}</td></tr>)}</tbody></table>
    </div>
   </Section>
   <Section title={'Fila de tarefas · '+fmt(d.openCrmTasks)+' abertas'}
    detail="Tarefas atuais com responsáveis, datas e contador histórico de ocorrências.">
    <div className="max-h-[390px] overflow-auto rounded-lg border border-border">
     <table className="w-full border-collapse text-left text-xs"><thead><tr>{['Tarefa','Responsável','Data prevista','Ocorrências'].map(x=><th className={th} key={x}>{x}</th>)}</tr></thead>
      <tbody>{d.taskQueue.map((x,i)=><tr key={i}><td className={td}>{x.title}</td><td className={td}>{x.assignee}</td><td className={td}>{date(x.dueOn)}</td><td className={td}>{x.occurrences}</td></tr>)}</tbody></table>
    </div>
    <Link className="mt-3 inline-block text-xs font-bold text-primary underline" href="/tarefas">Abrir fila operacional</Link>
   </Section>
   <Section title={'Processos prioritários · '+fmt(d.topCases.length)+' analisados'}
    detail="Score exclusivamente operacional: retorno, data cadastrada, fonte e responsável. Não expressa probabilidade judicial.">
    <div className="grid max-h-[560px] gap-2 overflow-y-auto sm:grid-cols-2">
      {d.topCases.map((x,i)=><article key={x.processId+'-'+i} className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
       <div className="flex items-center justify-between gap-2"><strong>{x.client}</strong><span className="font-bold text-primary">{x.severity} · {x.score}/100</span></div>
       <p className="mt-1 text-muted-foreground">{x.cnj||'Sem CNJ'} · Saúde {x.health}/100</p>
       <p className="mt-1">{x.lawyer} · {x.office}</p>
       <p className="mt-1">Retorno: {date(x.nextReturn)} · {x.outcome}</p>
       <p className="mt-2 text-muted-foreground">{x.reasons.length?x.reasons.join(' · '):'Nenhum alerta nos campos avaliados.'}</p>
       <Link href={'/processos?search='+encodeURIComponent(x.cnj||String(x.processId))} className="mt-2 inline-flex items-center gap-1 font-bold text-primary underline"><FileSearch size={13}/> Conferir processo</Link>
      </article>)}
    </div>
   </Section>
   <Section defaultOpen title={'Recomendações e ideias · '+fmt(d.recommendations.length)+' medidas'}
    detail="Prioridades geradas dos dados. Correções jurídicas ou de código precisam de revisão e testes.">
     <div className="grid gap-2 lg:grid-cols-2">{d.recommendations.map((r,i)=><article key={i} className="rounded-lg border border-border bg-muted/15 p-3">
       <p className="text-xs font-black">{r.priority} · {r.sector} · {r.title}</p>
       <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
       <p className="mt-2 text-xs">{r.action}</p>
       <p className="mt-1 text-[11px] text-muted-foreground">{r.automated?'Triagem/verificação automatizável':'Requer revisão humana'}</p>
      </article>)}</div>
   </Section>
   <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs leading-5">
    <strong>Autoaprendizado controlado:</strong> {d.learning.previousDay
     ?'Desde '+date(d.learning.previousDay)+': saúde '+String(d.learning.healthDelta??'—')+
       ', retornos '+String(d.learning.overdueDelta??'—')+', fontes desatualizadas '+String(d.learning.sourceGapDelta??'—')+'.'
     :'Primeira coleta: comparação histórica a partir de um próximo dia.'}
    <p className="mt-1 text-muted-foreground">A evolução usa resultados registrados para ajustar prioridades e propor mudanças. Não altera pesos de modelos, código ou conclusões judiciais sem avaliação.</p>
   </div>
 </section>;
}
