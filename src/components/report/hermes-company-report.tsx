import Link from 'next/link';
import { AlertTriangle, Award, Bot, ClipboardCheck, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  buildHermesOfficeIntelligence,
} from '@/lib/hermes-company-intelligence';
import type { HermesOfficeDailyRow } from '@/lib/hermes-company-service';

export function HermesCompanyReport({row}:{row:HermesOfficeDailyRow|null}){
 if(!row)return <section id="hermes-company-report" className="rounded-2xl border border-border bg-card p-5">
   <h2 className="flex items-center gap-2 font-bold"><Bot size={17}/> Hermes · relatório da empresa</h2>
   <p className="mt-2 text-sm text-muted-foreground">A primeira consolidação Hermes ainda não foi registrada pelo servidor.</p>
   <Link href="/hermes-3d" className="mt-2 inline-flex text-sm font-semibold text-primary underline">Abrir escritório</Link>
 </section>;
 const office=buildHermesOfficeIntelligence(row.metrics,row.day);
 return <section id="hermes-company-report" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-2">
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-primary">Relatório de gestão automatizada</p>
      <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold"><Bot size={19} className="text-primary"/> Hermes · Diretoria e setores</h2>
      <p className="mt-1 text-xs text-muted-foreground">Referência {row.day.split('-').reverse().join('/')} · situação de acompanhamento: {office.health}.</p>
    </div>
    <Link href="/hermes-3d" className="inline-flex items-center gap-2 rounded-xl border border-primary/20 px-3 py-2 text-xs font-bold text-primary hover:bg-muted">Ir ao escritório <ExternalLink size={13}/></Link>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
    {[
      ['Retornos vencidos',office.counters.overdue],
      ['Fontes a conferir',office.counters.staleSources],
      ['Revisões oficiais',office.counters.readyReviews],
      ['Atividades em 30 dias',office.counters.completedActivities30d],
    ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-border bg-muted/25 p-3">
      <strong className="text-xl font-extrabold tabular-nums">{Number(value).toLocaleString('pt-BR')}</strong>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>)}
  </div>
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <div>
      <h3 className="flex items-center gap-2 text-sm font-black"><AlertTriangle size={15} className="text-amber-500"/> Problemas e conflitos operacionais</h3>
      <div className="mt-2 space-y-2">
        {office.risks.map(r=><div key={r.id} className="rounded-xl border border-border p-3">
          <p className="text-xs font-bold">{r.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{r.detail}</p>
        </div>)}
      </div>
    </div>
    <div>
      <h3 className="flex items-center gap-2 text-sm font-black"><ClipboardCheck size={15} className="text-primary"/> Ata da reunião entre os setores</h3>
      <div className="mt-2 space-y-2">
        {office.meeting.map((m,i)=><p key={i} className="rounded-lg border border-border bg-muted/25 p-2 text-xs leading-5"><strong>{m.speaker}:</strong> {m.text}</p>)}
      </div>
      {row.meeting_note&&<p className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-6">
        <strong>{row.meeting_engine==='regras-verificadas'?'Síntese por regras':'Síntese IA do Superagente'}:</strong> {row.meeting_note}
        {row.meeting_status==='unavailable'&&<span> (A IA esteve indisponível; resumo baseado nas regras.)</span>}
      </p>}
    </div>
  </div>
  <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="flex items-center gap-2 text-xs font-bold"><Award size={15} className="text-amber-500"/> Medalha de produtividade</p>
      <p className="mt-1 text-xs text-muted-foreground">{office.award?
        office.award.basis+' — '+office.departments.find(d=>d.id===office.award?.department)?.role
        :'Nenhum prêmio até que haja contagem verificável.'}</p>
    </div>
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-primary"/> Capacitação e estratégias</p>
      <p className="mt-1 text-xs text-muted-foreground">{office.suggestedStrategy}</p>
    </div>
  </div>
  <p className="mt-4 text-[11px] text-muted-foreground">Este relatório não calcula chance de vitória/derrota ou empregados equivalentes. Só há sinalização operacional com fontes disponíveis; medidas jurídicas e substituição de agentes exigem revisão humana.</p>
 </section>;
}
