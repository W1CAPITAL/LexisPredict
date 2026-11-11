import Link from 'next/link';
import {Activity,Clock3,ExternalLink,ShieldAlert} from 'lucide-react';
import type {HermesStalledSummary} from '@/lib/hermes-company-service';
import {resolveOfficialCourtPortal,OFFICIAL_JUSBR_PORTAL,getHermesNationalSourcePlan} from '@/lib/hermes-official-fallbacks';

const statusLabel:Record<HermesStalledSummary['state'],string>={
 scanning:'Consulta oficial em andamento',
 confirmed_idle:'Sem movimentação oficial recente; fontes de movimento consultadas',
 no_dated_movement:'Consulta concluída, sem data de movimento recuperável',
 partial:'Consulta parcial · fonte pendente',
 unavailable:'Consulta indisponível',
 recent_movement:'Movimentação recente identificada',
};
const date=(value:string|null)=>value?value.slice(0,10).split('-').reverse().join('/'):'Não disponível';
export function HermesStalledMonitoring({items}:{items:HermesStalledSummary[]}){
 return <section id="hermes-stalled-monitoring" className="rounded-2xl border border-[#bb8aa3]/25 bg-[#211520] p-4 text-white sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <p className="text-xs font-bold uppercase tracking-widest text-[#dcb7cb]">Hermes · varredura automática</p>
    <h2 className="mt-2 flex items-center gap-2 text-xl font-black"><Activity size={20}/> Processos parados</h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#e8d4df]">
     O scanner acompanha processos ativos com pelo menos 15 dias sem sinal recente cadastrado.
     Verifica DJEN, DataJud e, quando houver integração oficial autorizada, a API do tribunal,
     independentemente do retorno ao cliente. Uma fonte indisponível não confirma ausência de movimentação e não torna o retorno vencido.
    </p>
   </div>
   <Link href="/processos-parados" className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
    Abrir carteira de parados <ExternalLink size={14}/>
   </Link>
  </div>
  <div className="mt-4 grid gap-3 sm:grid-cols-2">
   {!items.length?<div className="col-span-full rounded-xl border border-dashed border-[#af879a]/40 p-5 text-sm text-[#e7d5df]">
    Aguardando os primeiros registros de investigação do agendador. Nenhum resultado oficial será presumido.
   </div>:items.map(item=><article key={item.processId} className="rounded-xl border border-[#bd91a8]/25 bg-white/5 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div className="min-w-0">
      <p className="font-bold">{item.client}</p>
      <p className="mt-1 break-all font-mono text-xs text-[#e0bbcf]">{item.cnj||'Processo sem CNJ'}</p>
     </div>
     <span className="rounded-full border border-white/20 px-2 py-1 text-[11px] font-bold text-[#f3d9e5]">{statusLabel[item.state]}</span>
    </div>
    <p className="mt-2 text-xs text-[#e7d4df]">
     Última movimentação oficial conhecida: {date(item.lastMovementAt)}
     {item.daysWithoutMovement!==null?` · ${item.daysWithoutMovement} dia(s)`:''}
    </p>
    {item.sourceErrors.ultimaPublicacaoDjen&&<p className="mt-1 text-xs text-[#e7d4df]">Última publicação DJEN encontrada: {date(item.sourceErrors.ultimaPublicacaoDjen)}</p>}
    {item.sourceErrors.projudi&&<p className="mt-1 text-xs text-[#e7d4df]">TJPR PROJUDI MNI: {item.sourceErrors.projudi}</p>}
    <p className="mt-1 flex items-center gap-2 text-xs text-[#e7d4df]">
     <Clock3 size={13}/> Verificado: {date(item.checkedAt)}
    </p>
    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
     <span className="rounded-lg border border-white/20 px-2 py-1">DJEN: {item.djenOk?'consultado':'sem confirmação'}</span>
     <span className="rounded-lg border border-white/20 px-2 py-1">DataJud: {item.datajudOk?'consultado':'sem confirmação'}</span>
     {item.tribunalApiSource&&<span className="rounded-lg border border-white/20 px-2 py-1">{item.tribunalApiSource}: {item.tribunalApiOk?'consultado':item.tribunalApiAttempted?'sem confirmação':'não acionado'}</span>}
    </div>
    {!item.datajudOk&&item.sourceErrors.datajud&&<p className="mt-2 rounded-lg border border-[#e4bed0]/20 bg-black/15 px-3 py-2 text-xs leading-relaxed text-[#f0d4e0]">
     DataJud: {item.sourceErrors.datajud}
    </p>}
    {item.sourceErrors.fonteAlternativa&&<p className="mt-2 rounded-lg border border-[#bb90a5]/25 bg-white/5 p-2 text-xs text-[#f0d7e3]">{item.sourceErrors.fonteAlternativa}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-[#f4d2e3]">
     {resolveOfficialCourtPortal(item.cnj)&&<a href={resolveOfficialCourtPortal(item.cnj)!.url} target="_blank" rel="noopener noreferrer" className="underline">Consultar {resolveOfficialCourtPortal(item.cnj)!.label}</a>}
     {getHermesNationalSourcePlan(item.cnj)?.otherPortals.map(p=><a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="underline">{p.label}</a>)}
     <a href={OFFICIAL_JUSBR_PORTAL} target="_blank" rel="noopener noreferrer" className="underline">Jus.br · consulta unificada com login</a>
    </div>
    {(item.state==='partial'||item.state==='unavailable')&&<p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-[#e9c4c6]">
     <ShieldAlert size={14} className="mt-0.5 shrink-0"/> Revisão incompleta: a ausência de resultado não comprova processo parado.
    </p>}
    <Link href={'/processos?search='+encodeURIComponent(item.cnj||String(item.processId))}
     className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f4d2e3] underline">
     Conferir processo <ExternalLink size={13}/>
    </Link>
   </article>)}
  </div>
 </section>;
}
