import { createHash } from 'node:crypto';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { buildPublicationMessage } from '@/lib/wa-publication-templates';
import type { Alert, SourceRow } from '@/lib/wa-movement-builder';

/**
 * A publication is NOT a ruling. This builder is conservative: no dispatch if
 * the terminal event or the judgment outcome is missing or contradictory.
 */
export type PublicationSourceRow = SourceRow & {
  status?:string|null;status_interno?:string|null;alert_delivered_at?:string|null;
  datajud_encerrado_tribunal?:boolean|null;datajud_encerrado_motivo?:string|null;
  data_transito_julgado?:string|null;is_procedente?:boolean|null;
  procedente_motivo?:string|null;detalhes_execucao?:Record<string,unknown>|null;
  status_executivo?:string|null;
};
export type Verdict = 'procedente'|'parcial'|'improcedente'|'sem_merito'|'indeterminado';
export type TerminalKind = 'baixa'|'transito'|'extincao'|'arquivamento'|'encerramento';
export type PublicationNotice = Alert & {verdict:Verdict;kind:TerminalKind;};

export type PublicationReason = 'ok'|'already_closed'|'blocked'|'consent_missing'|'phone'|'no_terminal'|'review_verdict'|'review_conflict'|'already_notified';
export type Preparation = {notice:PublicationNotice|null;reason:PublicationReason};

const normalized=(v:unknown)=>String(v||'').replace(/<[^>]{0,150}>/g,' ').replace(/\s+/g,' ').trim().slice(0,550);
const flat=(v:unknown)=>normalized(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const yes=(v:unknown)=>v===true||['true','sim','s','1','yes'].includes(String(v??'').trim().toLowerCase());
const no=(v:unknown)=>v===false||['false','nao','não','n','0','no'].includes(String(v??'').trim().toLowerCase());
function phoneOf(v:unknown) {
  let d=String(v||'').replace(/\D/g,'');
  if(d.length===10||d.length===11)d='55'+d;
  return /^55\d{10,11}$/.test(d)?d:'';
}
function eventDate(v:unknown) {
  const str=String(v||'').trim();
  const pt=str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso=pt?`${pt[3]}-${pt[2]}-${pt[1]}`:str;
  const ms=Date.parse(iso);
  return Number.isFinite(ms)&&ms>=Date.UTC(2000,0,1)&&ms<=Date.now()+86_400_000?ms:0;
}
const weak=/\b(?:REQUER(?:IMENTO)?|SOLICIT\w*|AGUARD\w*|PEDID\w*|POSSIVEL|PRETEND\w*|PROXIMO|PENDENT\w*|MINUTA|RASCUNHO)\b/;
function detectTerminal(text:unknown):TerminalKind|null {
  const t=flat(text);
  if(!t || weak.test(t))return null;
  if(/\bBAIXA DEFINITIVA\b|\bPROCESSO BAIXADO DEFINITIVAMENTE\b/.test(t))return 'baixa';
  if(/\bARQUIVAMENTO DEFINITIVO\b|\bARQUIVAD[OA] DEFINITIVAMENTE\b/.test(t))return 'arquivamento';
  if(/\bTRANSITO EM JULGADO\b|\bTRANSITOU EM JULGADO\b/.test(t))return 'transito';
  if(/\bEXTINCAO DO PROCESSO\b|\bPROCESSO EXTINTO\b|\bJULGO EXTINTO\b|\bSENTENCA DE EXTINCAO\b|\bEXTINTO SEM RESOLUCAO\b/.test(t))return 'extincao';
  if(/\bENCERRADO NO TRIBUNAL\b|\bENCERRAMENTO DEFINITIVO DO PROCESSO\b/.test(t))return 'encerramento';
  return null;
}
const verdictIn=(v:unknown):Verdict=>{
  const t=flat(v);
  if(!t)return 'indeterminado';
  if(/SEM RESOLUCAO (DO )?MERITO|SEM JULGAMENTO (DO )?MERITO|EXTINTO SEM RESOLUCAO|EXTINCAO SEM RESOLUCAO/.test(t))return 'sem_merito';
  if(/PARCIALMENTE PROCEDENTE|PROCEDENTE EM PARTE|PROCEDENCIA PARCIAL/.test(t))return 'parcial';
  if(/IMPROCEDENTE|IMPROCEDENCIA|JULGO IMPROCEDENTES?/.test(t))return 'improcedente';
  if(/\bPROCEDENTE\b|\bPROCEDENCIA\b|\bJULGO PROCEDENTES?\b/.test(t))return 'procedente';
  return 'indeterminado';
};
export function preparePublicationNotice(row:PublicationSourceRow, opts:{includeClosed?:boolean}={}):Preparation {
  const meta=(row.dados&&typeof row.dados==='object')?row.dados:{};
  // Closed portfolio records are excluded even if DataJud flags are outdated.
  if(!opts.includeClosed && isCasoEncerrado({status:row.status,status_interno:row.status_interno,dados:meta}))return {notice:null,reason:'already_closed'};
  const blocked=['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout','bloquear_whatsapp','naoEnviarWhatsapp']
    .some(k=>yes(meta[k])) || ['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'].some(k=>k in meta && no(meta[k]));
  if(blocked)return {notice:null,reason:'blocked'};
  // Legal case data must not be broadcast to unconsenting recipients.
  const phone=phoneOf(row.telefone || meta.telefone || meta.TELEFONE);
  if(!phone)return {notice:null,reason:'phone'};
  const candidates=[
    {source:'DataJud' as const,date:eventDate(row.datajud_ultimo_movimento),text:normalized(row.datajud_ultimo_nome)},
    {source:'DJEN' as const,date:eventDate(row.djen_ultima_data),text:normalized(row.djen_ultimo_resumo)},
  ].map(c=>({...c,kind:detectTerminal(c.text)})).filter(c=>c.date>0&&c.kind);
  candidates.sort((a,b)=>b.date-a.date);
  // The last event may be a later ordinary movement; do not confuse its
  // date with a terminal event recorded in a stale separate flag.
  const chosen=candidates[0];
  if(!chosen)return {notice:null,reason:'no_terminal'};
  // An event recorded after the terminal marker can indicate reactivation.
  // Review manually instead of describing the old terminal event as current.
  const latest=[eventDate(row.datajud_ultimo_movimento),eventDate(row.djen_ultima_data)]
    .reduce((max,date)=>Math.max(max,date),0);
  if(latest>chosen.date)return {notice:null,reason:'no_terminal'};
  if(row.alert_delivered_at && eventDate(row.alert_delivered_at)>=chosen.date)
    return {notice:null,reason:'already_notified'};
  const verdictSources=[
    row.procedente_motivo,row.djen_ultimo_resumo,row.datajud_ultimo_nome,
    row.dados?.['merito_resultado'],row.detalhes_execucao?.['merito_tipo'],
  ];
  const results=[...new Set(verdictSources.map(verdictIn).filter(v=>v!=='indeterminado'))];
  if(results.length>1)return {notice:null,reason:'review_conflict'};
  if(!results.length)return {notice:null,reason:'review_verdict'};
  const verdict=results[0] as Exclude<Verdict,'indeterminado'>;
  if(!['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'].some(k=>yes(meta[k])))
    return {notice:null,reason:'consent_missing'};
  // A "procedente" boolean by itself does not prove whether the judgment
  // was partial, superseded or subsequently reversed.
  const name=normalized(row.cliente||meta.cliente||'Cliente').slice(0,90);
  const cnj=String(row.protocolo_ref||meta.protocolo||'').trim();
  if(!/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj))
    return {notice:null,reason:'no_terminal'};
  const when=new Date(chosen.date).toLocaleDateString('pt-BR',{timeZone:'UTC'});
  const first=name.split(/\s+/)[0]||'cliente';
  // Variations reflect different verifiable case facts, NOT random text churn
  // designed to bypass WhatsApp anti-spam filters.
  const content=buildPublicationMessage({
    firstName:first,cnj,date:when,source:chosen.source,kind:chosen.kind!,
    verdict,
  });
  const hash=createHash('sha256').update(
    [row.empresa_id,row.id,'publicacao_v1',chosen.kind,chosen.source,chosen.date,chosen.text,verdict].join('|')
  ).digest('hex');
  return {reason:'ok',notice:{
    empresa_id:row.empresa_id,processo_id:Number(row.id),
    protocolo:cnj,phone,client_name:name,source:chosen.source,event_at:new Date(chosen.date).toISOString(),
    event_hash:hash,message:content,kind:chosen.kind!,verdict,
  }};
}
