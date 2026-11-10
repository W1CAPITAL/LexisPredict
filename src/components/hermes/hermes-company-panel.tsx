'use client';

import Link from 'next/link';
import {
  Activity, AlertTriangle, Award, Bot, BrainCircuit, ClipboardList,
  Clock3, Crown, FileCheck2, GraduationCap, Medal, MessageSquareText,
  RefreshCcw, ShieldCheck, Trophy, Users, Workflow,
} from 'lucide-react';
import type { HermesCaseHealth,HermesOfficeIntelligence } from '@/lib/hermes-company-intelligence';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';

export function HermesCompanyPanel({office,record,cases,busy,error,onRefresh,onMeeting}:{
  office:HermesOfficeIntelligence|null;
  record:HermesOfficeDailyRow|null;
  cases:HermesCaseHealth[];
  busy:boolean;error:string;
  onRefresh:()=>void;onMeeting:()=>void;
}){
 return <section className="h3d-company-panel space-y-4" id="hermes-empresa" aria-label="Operação Hermes e conselho de IA">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-black uppercase tracking-[.17em] text-[#d5a4bc]">OPERACÃO COM EVIDÊNCIAS</p>
    <h2 className="mt-1 text-xl font-black text-white md:text-2xl">Diretoria e setores do escritório</h2>
    <p className="mt-1 text-xs leading-5 text-[#d0c2cf]">Atividades e achados reais no servidor; personagens e movimentos são uma representação visual.</p>
   </div>
   <button type="button" disabled={busy} onClick={onRefresh} className="h3d-button"><RefreshCcw size={14} className={busy?'animate-spin':''}/> Atualizar painel</button>
  </header>
  {error&&<p role="status" className="rounded-xl border border-amber-500/40 bg-amber-900/20 p-3 text-sm text-[#fff0e1]">{error}</p>}
  {!office||!record?<div className="rounded-2xl border border-white/15 bg-white/[.05] p-5 text-sm text-[#e6dbe3]">
    O primeiro relatório Hermes ainda não está disponível para esta sessão. O cron prepara os dados no servidor. Nenhum número foi simulado.
  </div>:<>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {[
        {label:'Processos ativos',value:office.counters.active,icon:FileCheck2},
        {label:'Retornos vencidos',value:office.counters.overdue,icon:Clock3},
        {label:'Alertas no cadastro',value:office.counters.alerts,icon:AlertTriangle},
        {label:'Revisões prontas',value:office.counters.readyReviews,icon:ShieldCheck},
        {label:'Atividades · 30 dias',value:office.counters.completedActivities30d,icon:Activity},
        {label:'Rascunhos',value:office.counters.draftMessages,icon:MessageSquareText},
      ].map(metric=><div key={metric.label} className="h3d-kpi">
        <metric.icon className="text-[#e9bbc9]" size={17}/>
        <strong className="mt-2 block text-2xl font-black tabular-nums">{metric.value.toLocaleString('pt-BR')}</strong>
        <span className="text-[11px] leading-4 text-[#d9c8d2]">{metric.label}</span>
      </div>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <article className="h3d-panel-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className="flex items-center gap-2 text-base font-black"><Users className="text-[#eabccc]" size={18}/> Sala de reuniões</h3>
            <p className="mt-1 text-xs text-[#d2bfd0]">Pauta produzida a partir dos registros em {record.day.split('-').reverse().join('/')}. Última atualização: {new Date(record.updated_at).toLocaleString('pt-BR')}.</p>
          </div>
          <button type="button" onClick={onMeeting} disabled={busy||record.meeting_status!=='pending'} className="h3d-button">
            <BrainCircuit size={15}/> {record.meeting_status==='pending'?'Gerar reunião com Superagente':record.meeting_status==='running'?'Reunião em execução':'Reunião registrada'}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {office.meeting.map((m,i)=><div key={i} className="h3d-meeting-line">
            <span className="text-xs font-extrabold text-[#eec8d8]">{m.speaker}</span>
            <p className="mt-1 text-xs leading-5 text-[#e8dee6]">{m.text}</p>
          </div>)}
        </div>
        {record.meeting_note&&<div className="mt-3 rounded-xl border border-[#cda9bc]/30 bg-[#77425e]/25 p-4 text-xs leading-6 text-[#fff3f8]">
          <p className="mb-1 font-bold">Síntese da reunião · {record.meeting_engine==='regras-verificadas'?'regras determinísticas':'IA do Superagente'}</p>
          <p>{record.meeting_note}</p>
          {record.meeting_status==='unavailable'&&<p className="mt-2 text-amber-200">O modelo não respondeu nesta execução. Foi preservada a síntese baseada nas regras e métricas.</p>}
        </div>}
        <p className="mt-3 text-[11px] text-[#c9b8c3]">Nenhuma reunião alterou processos, enviou mensagens ou tomou ciência judicial.</p>
      </article>
      <article className="h3d-panel-card p-5">
        <h3 className="flex items-center gap-2 text-base font-black"><AlertTriangle size={18} className="text-[#e4b6c5]"/> Maiores gargalos verificados</h3>
        <p className="mt-1 text-xs text-[#d9c9d1]">Saúde operacional: <strong className="text-white">{office.health}</strong> — não é previsão de resultado judicial.</p>
        <div className="mt-4 space-y-2">
         {office.risks.map(r=><Link href={r.href} key={r.id} className="block rounded-xl border border-white/10 bg-white/[.045] px-3 py-3 transition-colors hover:bg-white/10">
           <span className="font-semibold text-sm">{r.label}</span>
           <p className="mt-1 text-xs leading-5 text-[#d8c8d2]">{r.detail}</p>
         </Link>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/tarefas" className="h3d-button"><ClipboardList size={15}/> Ver prioridades</Link>
          <Link href="/report" className="h3d-button h3d-button-muted"><Workflow size={15}/> Relatório completo</Link>
        </div>
      </article>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
     <article className="h3d-panel-card p-5">
       <h3 className="flex items-center gap-2 text-base font-black"><Crown size={17} className="text-[#f1c7d5]"/> Organograma do escritório</h3>
       <p className="mt-1 text-xs text-[#d9c4d1]">Cada cargo possui responsabilidades próprias. As contagens são registros de trabalho, não pessoas substituídas.</p>
       <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {office.departments.map((d)=><Link href={d.href} key={d.id} className="h3d-department">
          <div className="flex items-center gap-2"><Bot style={{color:d.color}} size={17}/><span className="text-xs font-black">{d.role}</span>{d.award&&<Medal size={15} className="ml-auto text-[#f3d59d]"/>}</div>
          <p className="mt-1 text-[11px] text-[#d5c5ce]">{d.title}</p>
          <p className="mt-1 text-[11px] text-[#e3b9cd]">{d.workload} registros relacionados · {d.status==='pendencias'?'há itens a revisar':'monitoramento'}</p>
        </Link>)}
       </div>
     </article>
     <article className="h3d-panel-card p-5">
       <h3 className="flex items-center gap-2 text-base font-black"><Trophy size={18} className="text-[#eed2a0]"/> Reconhecimento e melhoria contínua</h3>
       {office.award?<div className="mt-3 flex items-start gap-3 rounded-xl border border-[#bd9c62]/40 bg-[#967544]/10 p-4">
         <Award size={28} className="shrink-0 text-[#edd49e]"/>
         <div><p className="font-black text-sm">{office.award.label}</p><p className="mt-1 text-xs text-[#e7d9c6]">{office.departments.find(d=>d.id===office.award?.department)?.role}: {office.award.basis}.</p></div>
       </div>:<p className="mt-3 text-xs text-[#e3cfd9]">Sem medalhas até existirem registros verificáveis.</p>}
       <div className="mt-4 rounded-xl border border-white/10 bg-white/[.04] p-4">
         <p className="flex items-center gap-2 text-sm font-bold"><GraduationCap size={17} className="text-[#e7bccc]"/> Treinamento e novas versões</p>
         <p className="mt-2 text-xs leading-5 text-[#e0cdd6]">{office.suggestedStrategy}</p>
         <p className="mt-2 text-xs leading-5 text-[#d0bac7]">Uma versão ruim gera revisão e proposta de substituição; nunca autoalteração de código, contratação ou exclusão de dados jurídicos. Versões só são promovidas depois de testes e aprovação.</p>
       </div>
     </article>
    </div>
    <article className="h3d-panel-card p-5" id="hermes-case-health">
      <h3 className="flex items-center gap-2 text-base font-black"><ShieldCheck size={18} className="text-[#edc6d7]"/> Saúde operacional por processo</h3>
      <p className="mt-1 text-xs leading-5 text-[#d8c4cf]">Só as últimas revisões que possuem registro DJEN/DataJud. Não é chance de ganhar ou perder a ação; consulte documentos e decisões antes de uma conclusão jurídica.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map(row=><Link key={row.processId} href={row.cnj?'/processos?search='+encodeURIComponent(row.cnj):'/processos'} className="h3d-department">
          <p className="truncate text-xs font-black">{row.client}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-[#c8b5c0]">{row.cnj||'CNJ não informado'}</p>
          <p className="mt-2 text-xs font-bold text-[#e8bccc]">{row.level}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#d5c1cd]">{row.sourceStatus}</p>
          <p className="mt-1 text-[10px] text-[#a997a4]">Retorno: {row.dueOn||'sem data'} · Consulta: {row.checkedAt?.slice(0,10)||'sem confirmação'}</p>
        </Link>)}
      </div>
      {!cases.length&&<p className="mt-3 text-sm text-[#d2becb]">Nenhuma revisão individual registrada nesta amostra. As consultas do scanner continuam na fila própria.</p>}
    </article>
    <p className="px-1 text-[11px] leading-5 text-[#cbbbc5]">
      Contatos e atividades são registros históricos. Nenhuma estimativa de “quantos funcionários a IA substitui” ou percentual de vitória/derrota é fabricada. Riscos exibidos são sinais operacionais para revisão humana.
    </p>
  </>}
 </section>;
}
