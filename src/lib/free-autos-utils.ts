import {canonicalCnj} from './autos-oab-logic';
import {TRIBUNAIS_TJ} from './tribunais-links';

/** Dados locais não são prova de acesso nem de autoria por um banco. */
export type LocalAutosKind='inicial'|'contestacao'|'outro';
export type LocalAutosClass={kind:LocalAutosKind;isConsolidated:boolean;bankNamed:boolean};
export type AutosLocalItem={
  id:string;
  filename:string;
  bytes:Uint8Array;
  kind:LocalAutosKind;
  date?:string;
  preview?:string;
  isConsolidated?:boolean;
  bankNamed?:boolean;
  pages?:number;
  sourceArchive?:string;
};

function plain(s:string):string{
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
}
export function normalizeAutasFilename(fileName:string):string {
  const name=String(fileName||'').replace(/\\/g,'/').split('/').pop()||'documento';
  return name.replace(/[\u0000-\u001f<>:"|?*]/g,'').slice(0,140).trim()||'documento';
}
export function classifyLocalAutosDocument(filename:string,preview=''):LocalAutosClass {
  const name=plain(normalizeAutasFilename(filename));
  const begins=plain(preview.slice(0,1200)).slice(0,500);
  const isConsolidated=/\b(autos (processuais|digitais|completos|integral|do processo)|processo (integral|completo)|inteiro teor|baixar autos)\b/.test(name);
  const exclude=/\b(replica|impugnacao|manifestacao|resposta a contestacao|contrarrazoes|apelacao|recurso|analise da contestacao|despacho|sentenca)\b/.test(name);
  const asHeading=/^(?:poder judiciario.{0,100})?(?:exmo.{0,200})?(?:[a-z\s]{0,65})?(?:contestacao|defesa do reu|peca de defesa)\b/.test(begins);
  const isDefense=(!exclude && /\b(contestacao|defesa do reu|peca de defesa)\b/.test(name)) ||
    (name.match(/^(?:\d+[.\s-]+)?(?:documento|peca|anexo)\b/) && asHeading);
  const isInicial=/\b(peticao inicial|exordial|peca inaugural|peticao de inicio)\b/.test(name) ||
    (!isDefense && /^(?:\d+[.\s-]+)?(?:peticao inicial|exordial)\b/.test(begins));
  return {
    kind: isDefense?'contestacao':isInicial?'inicial':'outro',
    isConsolidated,
    // Mention of a bank does not establish that it is the defendant or signed the defense.
    bankNamed:/\b(banco|financeira|instituicao financeira)\b/.test(name),
  };
}
function fileOrder(name:string):[number,string] {
  const normalized=normalizeAutasFilename(name);
  const prefix=normalized.match(/^(?:peca\s*)?(\d{1,6})\s*[-_. )]/i);
  return [prefix?Number(prefix[1]):Number.MAX_SAFE_INTEGER,normalized.toLocaleLowerCase('pt-BR')];
}
export function selectAutosThroughDefesa<T extends Pick<AutosLocalItem,'id'|'filename'|'kind'>>(documents:T[]):{
  files:T[];foundContestacao:boolean;bankDefendantConfirmed:false;limitedByMetadata:boolean;cutoffApplied:boolean;
}{
  const sorted=[...documents].sort((a,b)=>{
    const x=fileOrder(a.filename),y=fileOrder(b.filename);
    return x[0]-y[0]||x[1].localeCompare(y[1],'pt-BR',{numeric:true});
  });
  const index=sorted.findIndex(doc=>doc.kind==='contestacao');
  const limitedByMetadata=sorted.some(x=>fileOrder(x.filename)[0]===Number.MAX_SAFE_INTEGER);
  // Never silently discard pleadings with uncertain chronology. Sorting by
  // alphabet would put 'Contestação' ahead of 'Petição Inicial'.
  const cutoffApplied=index>=0 && !limitedByMetadata;
  return {files:cutoffApplied?sorted.slice(0,index+1):sorted,
    foundContestacao:index>=0,
    bankDefendantConfirmed:false,
    limitedByMetadata,cutoffApplied,
  };
}
export function findOfficialAutosPortal(cnj:string):{
  tribunal:string;sistema:string;url:string;cnj:string;
}|null{
  const value=canonicalCnj(cnj);
  if(!value)return null;
  const digits=value.replace(/\D/g,'');
  if(digits[13]!=='8')return null;
  const code='8.'+digits.slice(14,16);
  const tribunal=TRIBUNAIS_TJ.find(row=>row.codigo===code);
  if(!tribunal)return null;
  try{
    const url=new URL(tribunal.url);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.jus.br'))return null;
    return {tribunal:tribunal.sigla,sistema:tribunal.sistema,url:url.href,cnj:value};
  }catch{return null;}
}
