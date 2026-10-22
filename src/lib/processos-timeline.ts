/**
 * Cronologia do inspetor /processos. Não colapsar movimentos judiciais em "último evento".
 * Os eventos DataJud são mantidos individualmente, inclusive após a sentença.
 */
import { normalizeDataJudMovimento, resolveDjenPublicationTitle } from '@/lib/timeline-normalize';

export type ProcessTimelineEntry = {
  id: string;
  cnj: string;
  date: string;
  label: string;
  detail: string;
  source: 'DataJud' | 'DJEN' | 'Atendimento' | 'Cadastro';
  phase: 'cumprimento' | 'conhecimento' | 'operacional';
  link?: string;
};

export type ProcessTimelineSource = {
  cnj: string;
  linked?: boolean;
  classe?: string;
  movimentos?: unknown[];
  comunicacoes?: unknown[];
};

const onlyDigits=(value:unknown)=>String(value??'').replace(/\D/g,'');
const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();

export function cnjDigits(value:unknown){
  const d=onlyDigits(value);
  return d.length===20?d:'';
}

export function formatCnj(value:unknown){
  const d=cnjDigits(value);
  return d ? `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}` : String(value??'');
}

function eventMillis(value:string){
  if(!value)return 0;
  const iso=/^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const br=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  const parsed=iso ? Date.parse(value) : br ? Date.parse(`${br[3]}-${br[2]}-${br[1]}T12:00:00`) : Date.parse(value);
  return Number.isFinite(parsed)?parsed:0;
}

function movementDate(m:Record<string,unknown>){
  return clean(m.dataHora || m.data || m.dataMovimento || m.data_hora || m.date);
}

function phaseFor(value:string, isLinked:boolean){
  return isLinked || /CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN[CÇ]A|ART\.?\s*523\b|ART\.?\s*524\b|IMPUGNA[CÇ][AÃ]O\s+AO\s+CUMPRIMENTO/i.test(value)
    ? 'cumprimento' as const : 'conhecimento' as const;
}

export function buildProcessTimeline(
  mainCnj:string,
  sources:ProcessTimelineSource[],
  operational?:{ultimoRetorno?:string|null;observacao?:string|null;dataDistribuicao?:string|null;classe?:string|null}
):ProcessTimelineEntry[]{
  const base=cnjDigits(mainCnj);
  const entries:ProcessTimelineEntry[]=[];
  const seen=new Set<string>();
  const add=(event:Omit<ProcessTimelineEntry,'id'>,sourceId='')=>{
    if(!event.date&&!event.label&&!event.detail)return;
    const key=event.source+'|'+event.cnj+'|'+(sourceId||[event.date,event.label,event.detail].join('|'));
    if(seen.has(key))return;
    seen.add(key);
    entries.push({...event,id:key});
  };
  for(const source of sources){
    const cnj=cnjDigits(source.cnj);
    if(!cnj)continue;
    const linked=!!source.linked || cnj!==base;
    // No mesmo CNJ, atos posteriores à abertura da fase executiva continuam
    // sendo do cumprimento, mesmo que intitulados apenas "Petição" ou "Despacho".
    const normalized=(source.movimentos||[]).map(normalizeDataJudMovimento);
    const phaseStart=normalized
      .filter(m=>phaseFor(clean(m.nome)+' '+clean(m.complemento),false)==='cumprimento')
      .map(m=>eventMillis(movementDate(m)))
      .filter(ts=>ts>0)
      .sort((a,b)=>a-b)[0]||0;
    for(const item of normalized){
      const m=item;
      const date=movementDate(m);
      const label=clean(m.nome||'Movimentação processual');
      const detail=clean(m.complemento||m.descricao||'');
      const inCumprimento=linked || (phaseStart>0 && eventMillis(date)>=phaseStart);
      add({cnj,date,label,detail,source:'DataJud',phase:phaseFor(label+' '+detail+' '+(source.classe||''),inCumprimento)});
    }
    for(const item of source.comunicacoes||[]){
      if(!item||typeof item!=='object')continue;
      const d=item as Record<string,unknown>;
      const date=clean(d.data_disponibilizacao||d.dataDisponibilizacao||d.data||'');
      const label=resolveDjenPublicationTitle(d);
      const detail=clean(d.texto||d.conteudo||d.descricao||d.nomeOrgao||'');
      const rawLink=clean(d.link);
      const link=rawLink.startsWith('https://')?rawLink:undefined;
      add({cnj,date,label,detail,source:'DJEN',phase:phaseFor(label+' '+detail+' '+(source.classe||''),linked),link},clean(d.hash||d.id));
    }
  }
  if(base&&operational?.ultimoRetorno){
    add({cnj:base,date:clean(operational.ultimoRetorno),label:'Último retorno ao cliente',detail:clean(operational.observacao),source:'Atendimento',phase:'operacional'});
  }
  if(base&&operational?.dataDistribuicao){
    add({cnj:base,date:clean(operational.dataDistribuicao),label:'Distribuição / ajuizamento',detail:clean(operational.classe),source:'Cadastro',phase:'operacional'});
  }
  // Eventos sem horário aparecem depois daqueles datados. Nenhum slice/limite de 8.
  return entries.sort((a,b)=>eventMillis(b.date)-eventMillis(a.date)||a.cnj.localeCompare(b.cnj)||a.label.localeCompare(b.label));
}

/**
 * Somente vínculos explícitos no cadastro podem acrescentar outro CNJ.
 * Nunca inferir um cumprimento apenas porque parte/nome/observação coincide.
 */
export function linkedCumprimentoCnjs(dados:unknown,primaryCnj:string):string[]{
  if(!dados||typeof dados!=='object')return [];
  const row=dados as Record<string,unknown>;
  const keys=[
    'cnj_cumprimento','cumprimento_cnj','numero_cumprimento','numero_processo_cumprimento',
    'processo_cumprimento','processo_cumprimento_cnj','protocolo_cumprimento',
    'cumprimento_numero','cnjCumprimento','numeroCumprimento'
  ];
  const found=new Set<string>();
  for(const key of keys){
    const value=row[key];
    if(typeof value==='string'||typeof value==='number'){
      const cnj=cnjDigits(value);
      if(cnj&&cnj!==cnjDigits(primaryCnj))found.add(cnj);
    }
  }
  for(const item of Array.isArray(row.processos_vinculados)?row.processos_vinculados:[]){
    if(!item||typeof item!=='object')continue;
    const entry=item as Record<string,unknown>;
    if(!/cumprimento|execu[cç][aã]o/i.test(clean(entry.tipo||entry.fase||entry.classe)))continue;
    const cnj=cnjDigits(entry.cnj||entry.numeroProcesso||entry.protocolo);
    if(cnj&&cnj!==cnjDigits(primaryCnj))found.add(cnj);
  }
  return [...found].slice(0,5);
}

/** Mescla páginas DJEN e o histórico DataJud sem perder atos antigos. */
export function mergeProcessTimelineEntries(oldEntries:ProcessTimelineEntry[],newEntries:ProcessTimelineEntry[]){
  const unique=new Map<string,ProcessTimelineEntry>();
  for(const entry of [...oldEntries,...newEntries])unique.set(entry.id,entry);
  return [...unique.values()].sort((a,b)=>
    eventMillis(b.date)-eventMillis(a.date)||
    a.cnj.localeCompare(b.cnj)||
    a.label.localeCompare(b.label)
  );
}
