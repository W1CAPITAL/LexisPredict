import Link from 'next/link';
import {Activity,CalendarDays,ShieldAlert} from 'lucide-react';
import type {HermesPortfolioCaseSummary} from '@/lib/hermes-company-service';
const d=(s?:string|null)=>s&&/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const merits:Record<string,string>={procedente:'Procedente',parcialmente_procedente:'Parcialmente procedente',improcedente:'Improcedente'};
export function HermesPortfolioMonitoring({items}:{items:HermesPortfolioCaseSummary[]}){
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" id="hermes-portfolio-monitor">
  <div>
   <p className="text-xs font-bold uppercase tracking-widest text-[#8c4b67] dark:text-[#eab9ce]">Hermes · scanner de toda a empresa</p>
   <h2 className="mt-1 flex items-center gap-2 text-xl font-black"><Activity size={20}/> Histórico judicial e sinais relevantes</h2>
   <p className="mt-2 text-sm text-muted-foreground">Todos os processos da carteira com CNJ válido são elegíveis, mesmo sem retorno vencido ou paralisação. Movimentações DataJud e publicações DJEN são diferentes. Os sinais dependem do teor recuperado, sem criar decisões ou valores.</p>
  </div>
  {!items.length?<p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Aguardando o primeiro processamento da nova fila judicial.</p>:
   <div className="grid gap-3 lg:grid-cols-2">{items.slice(0,24).map(r=>{
    const f=r.findings||{},m=f.verdict,hearing=Array.isArray(f.hearings)?f.hearings[0]:null;
    return <article key={r.processId} className="rounded-xl border border-border bg-background/60 p-4">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-bold">{r.client}</p><p className="break-all font-mono text-xs text-muted-foreground">{r.cnj}</p></div>
      <span className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold">{r.state==='ready'?'Duas fontes':r.state==='partial'?'Consulta parcial':'Pendente'}</span>
     </div>
     <p className="mt-2 text-xs text-muted-foreground">Verificado: {d(r.checkedAt)} · DataJud {r.datajudOk?'✓':'pendente'} · DJEN {r.djenOk?'✓':'pendente'}</p>
     <p className="mt-1 text-xs text-muted-foreground">Último movimento: {d(f.latestCourtMovement)} · Publicação DJEN: {d(f.latestDjenPublication)}</p>
     {m?.value&&<p className="mt-2 rounded-lg border border-border p-2 text-sm font-bold">{merits[m.value]||m.value} · {m.source} <span className="block text-xs font-normal text-muted-foreground">{String(m.excerpt||'').slice(0,240)}</span></p>}
     {hearing&&<p className="mt-2 flex flex-wrap items-center gap-2 text-xs"><CalendarDays size={14}/> {hearing.kind||'Audiência'} · {d(hearing.date)}{hearing.time?' às '+hearing.time:''}{hearing.meetingUrl?<a href={hearing.meetingUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Link indicado no ato</a>:null}</p>}
     {f.enforcement?.value&&<p className="mt-1 text-xs">Cumprimento de sentença: {f.enforcement.value==='cumprimento_iniciado'?'sinal de instauração':'menção localizada'} · {f.enforcement.source}</p>}
     {f.attorneyFees?.value&&<p className="mt-1 text-xs">Honorários sucumbenciais: menção oficial{typeof f.attorneyFees.percentage==='number'?' · '+f.attorneyFees.percentage+'%':''} · conferir dispositivo</p>}
     {f.legalAid?.value&&<p className="mt-1 text-xs">Justiça gratuita: {f.legalAid.value} no texto · {f.legalAid.source}</p>}
     {f.courtCosts?.value&&<p className="mt-1 text-xs">Custas: {f.courtCosts.amount||'valor não localizado'} · exigibilidade não verificada</p>}
     {!m&&!hearing&&!f.enforcement&&!f.attorneyFees&&!f.courtCosts&&!f.legalAid&&<p className="mt-2 text-xs text-muted-foreground">Nenhum sinal dessas categorias recuperado; isso não confirma que os autos estejam sem movimentação.</p>}
     {r.state!=='ready'&&<p className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert size={13} className="shrink-0"/> {r.sourceErrors.datajud||r.sourceErrors.djen||'Fonte pendente de confirmação'}</p>}
     <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold underline">
      <Link href={'/veredito?cnj='+encodeURIComponent(r.cnj)}>Consultar no Veredito</Link>
      <Link href={'/processos?search='+encodeURIComponent(r.cnj)}>Abrir processo</Link>
     </div>
    </article>;
   })}</div>}
  <p className="text-xs leading-relaxed text-muted-foreground">O relatório é operacional. Um rótulo no DataJud ou uma publicação DJEN não substituem o inteiro teor da sentença nem confirmam honorários devidos, custas exigíveis ou pagamento. CAPTCHA e autenticação dos portais não são contornados.</p>
 </section>;
}
