import type {LegalCase} from './case-logic';

export type ProcessSourceKind='datajud'|'djen'|'sistema'|'oab'|'snapshot'|'operacao';
export type ProcessSourceEntry={
  id:ProcessSourceKind;
  label:string;
  category:'oficial'|'operacional'|'evidencia';
  available:boolean;
  fresh?:boolean;
  detail:string;
};

function clean(v:unknown){return String(v??'').replace(/\s+/g,' ').trim()}

function parseDate(value:unknown){
  const raw=clean(value);
  if(!raw)return null;
  const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const d=iso
    ? new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`)
    : br
      ? new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`)
      : new Date(raw);
  return Number.isNaN(d.getTime())?null:d;
}

function daysSince(value:unknown){
  const d=parseDate(value);
  if(!d)return null;
  return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));
}

function pick(c:LegalCase,...keys:string[]){
  const row=c as any;
  for(const key of keys){
    const value=row?.[key];
    if(value!==undefined&&value!==null&&clean(value))return value;
  }
  return '';
}

export function processSourceMatrix(c:LegalCase):ProcessSourceEntry[]{
  const datajudDays=daysSince((c as any).datajud_consultado_em);
  const djenDays=daysSince((c as any).djen_consultado_em);
  const system=clean(pick(c,'sistema_nome','sistema'));
  const oab=clean(pick(c,'oab','oab_numero','advogado_oab'));
  const hasSnapshot=!!clean((c as any).datajud_hash);
  const hasOperational=!!(
    clean(c.ultimoRetorno)||
    clean(c.proximoPrazo)||
    clean((c as any).created_by)||
    clean((c as any).atendido_por)
  );
  return [
    {
      id:'datajud',label:'DataJud CNJ',category:'oficial',
      available:datajudDays!==null,
      fresh:datajudDays!==null&&datajudDays<=7,
      detail:datajudDays===null?'não consultado':datajudDays<=1?'consultado hoje/ontem':`consultado há ${datajudDays} dias`
    },
    {
      id:'djen',label:'DJEN',category:'oficial',
      available:djenDays!==null,
      fresh:djenDays!==null&&djenDays<=7,
      detail:djenDays===null?'não consultado':djenDays<=1?'consultado hoje/ontem':`consultado há ${djenDays} dias`
    },
    {
      id:'sistema',label:'Sistema processual',category:'oficial',
      available:!!system,
      detail:system||'não informado pelo dado carregado'
    },
    {
      id:'oab',label:'OAB / CNA',category:'oficial',
      available:!!oab,
      detail:oab?'identificador disponível para validação':'OAB não cadastrada no processo'
    },
    {
      id:'snapshot',label:'Snapshot / hash',category:'evidencia',
      available:hasSnapshot,
      detail:hasSnapshot?'comparação de mudança disponível':'sem hash de comparação'
    },
    {
      id:'operacao',label:'Carteira / atendimento',category:'operacional',
      available:hasOperational,
      detail:hasOperational?'dados operacionais presentes':'sem retorno/dono/atendimento suficiente'
    }
  ];
}

export function processSourceGapCount(c:LegalCase){
  const matrix=processSourceMatrix(c);
  return matrix.filter(x=>!x.available||(x.id==='datajud'||x.id==='djen')&&x.fresh===false).length;
}

export type RecommendedAction={
  tone:'red'|'amber'|'blue'|'green'|'slate';
  title:string;
  detail:string;
  route?:string;
};

export function recommendedProcessActions(c:LegalCase):RecommendedAction[]{
  const out:RecommendedAction[]=[];
  const status=clean(c.status);
  const silence=typeof (c as any).diasTribunal==='number'
    ? Number((c as any).diasTribunal)
    : daysSince(
        pick(c,'datajud_ultimo_movimento','evento_data','djen_ultima_data','datajud_consultado_em')
      );
  const criticalText=clean((c as any).djen_ultimo_resumo||(c as any).evento_resumo).toUpperCase();
  const hasCritical=/PENHORA|BLOQUEIO|SISBAJUD|RENAJUD|LIMINAR|TUTELA|AUDI[EÊ]NCIA|INTIMA[CÇ][AÃ]O|PRAZO|SENTEN[CÇ]A|TR[AÂ]NSITO|ARQUIVAMENTO/.test(criticalText);

  if(status==='Vencido'||status==='Caso Crítico'||((c as any).diasFaltando!=null&&Number((c as any).diasFaltando)<0)){
    out.push({tone:'red',title:'Tratar retorno vencido',detail:'Revisar o processo e registrar atendimento/novo retorno antes de seguir a fila.'});
  }
  if((c as any).djen_nova_comunicacao||hasCritical){
    out.push({tone:'red',title:'Revisar publicação DJEN',detail:'Há publicação nova ou termo crítico; leia o inteiro teor disponível antes de definir prazo ou mensagem.'});
  }
  if((c as any).tem_atualizacao_pos_retorno||(c as any).tem_novo_andamento){
    out.push({tone:'amber',title:'Atualizar cliente após novidade',detail:'O tribunal mudou depois do último retorno registrado. Compare o evento e prepare novo contato.'});
  }
  if(silence!=null&&silence>=45){
    out.push({tone:'amber',title:'Auditar silêncio processual',detail:`Há ${silence} dias sem movimento conhecido nesta visão. Atualize DataJud/DJEN antes de concluir que o processo está parado.`});
  }
  const sourceGaps=processSourceGapCount(c);
  if(sourceGaps>=2){
    out.push({tone:'blue',title:'Completar fontes',detail:`${sourceGaps} fonte(s) estão ausentes ou envelhecidas. Rode DataJud/DJEN e valide identificadores antes da análise.`});
  }
  const oab=clean(pick(c,'oab','oab_numero','advogado_oab'));
  if(clean(c.advogado)&&!oab){
    out.push({tone:'slate',title:'Completar OAB do advogado',detail:'Há advogado cadastrado, mas sem OAB utilizável para validação no CNA.'});
  }
  if(!out.length){
    out.push({tone:'green',title:'Fluxo sem alerta crítico',detail:'As regras operacionais não identificaram urgência. Mantenha o próximo retorno e monitore novas movimentações.'});
  }
  return out.slice(0,5);
}

export function processOperationalCoverage(c:LegalCase){
  const matrix=processSourceMatrix(c);
  const weights:Record<ProcessSourceKind,number>={
    datajud:3,djen:2,sistema:1,oab:1,snapshot:2,operacao:3
  };
  let got=0,total=0;
  for(const row of matrix){
    const w=weights[row.id];
    total+=w;
    if(row.available)got+=w;
    if((row.id==='datajud'||row.id==='djen')&&row.available&&row.fresh===false)got-=w*.35;
  }
  return Math.max(0,Math.min(100,Math.round(got/total*100)));
}
