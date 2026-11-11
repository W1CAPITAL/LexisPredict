'use server';

/**
 * Histórico detalhado para o inspetor /processos. Consultado somente quando a aba Mov. abre.
 * Nunca correlacionar cumprimento por simples semelhança de nome/parte.
 */
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import {requestDataJudWithCapacity} from '@/lib/hermes-return-service';
import {getProcessDataJudStatus,type ProcessSourcesStatus} from '@/lib/processos-movement-source-policy';
import { fetchDjenComunicacoes } from '@/lib/djen';
import {
  buildProcessTimeline, mergeProcessTimelineEntries, cnjDigits, formatCnj, linkedCumprimentoCnjs,
  type ProcessTimelineSource, type ProcessTimelineEntry
} from '@/lib/processos-timeline';
import {recoverHermesTimelineSource} from '@/lib/hermes-timeline-fallback';

export type ProcessMovementsResult = {
  success:boolean;
  entries:ProcessTimelineEntry[];
  message:string;
  hasMore:boolean;
  page:number;
  totalDjen:number;
  relatedCnjs:string[];
  warnings:string[];
  consultadoEm?:string;
  datajudMovements?:number;
  historicDataJudMovements?:number;
  djenPublications?:number;
  sourceStatus?:ProcessSourcesStatus;
};

const MAX_PAGE=200;
const DJEN_PER_PAGE=50;

export async function fetchProcessosMovementsAction(recordId:string, requestedCnj:string, requestedPage=1, forceRefresh=false):Promise<ProcessMovementsResult>{
  const main=cnjDigits(requestedCnj);
  const page=Number(requestedPage);
  if(!main||!Number.isInteger(page)||page<1||page>MAX_PAGE){
    return {success:false,entries:[],message:'CNJ ou página inválidos.',hasMore:false,page:1,totalDjen:0,relatedCnjs:[],warnings:[]};
  }

  try{
    const ctx=await getUserContext();
    if(!ctx?.auth_id||!ctx?.empresa_id){
      return {success:false,entries:[],message:'Sessão expirada. Entre novamente.',hasMore:false,page,totalDjen:0,relatedCnjs:[],warnings:[]};
    }
    const db=await getSupabaseAdmin();
    if(!db){
      return {success:false,entries:[],message:'Banco de dados indisponível.',hasMore:false,page,totalDjen:0,relatedCnjs:[],warnings:[]};
    }

    // Conferir tenant e registro no servidor antes de consultar fontes oficiais.
    // /processos é uma leitura empresarial, mesmo para usuários sem permissão de edição.
    let found:any=null;
    const key=String(recordId||'').trim();
    if(key){
      const result=await db.from('processos')
        .select('id,protocolo_ref,dados,ultimo_retorno,observacoes')
        .eq('empresa_id',ctx.empresa_id)
        .eq('id',key)
        .maybeSingle();
      if(!result.error && cnjDigits(result.data?.protocolo_ref)===main)found=result.data;
    }
    if(!found){
      for(const cnj of [main,formatCnj(main)]){
        const result=await db.from('processos')
          .select('id,protocolo_ref,dados,ultimo_retorno,observacoes')
          .eq('empresa_id',ctx.empresa_id)
          .eq('protocolo_ref',cnj)
          .limit(1);
        if(!result.error&&result.data?.length){
          found=result.data[0];
          break;
        }
      }
    }
    if(!found||cnjDigits(found.protocolo_ref)!==main){
      return {success:false,entries:[],message:'Processo não localizado na carteira autorizada.',hasMore:false,page,totalDjen:0,relatedCnjs:[],warnings:[]};
    }

    const metadata=found.dados&&typeof found.dados==='object'?found.dados as Record<string,unknown>:{};
    const relatedCnjs=linkedCumprimentoCnjs(metadata,main);
    const cnjs=[main,...relatedCnjs];
    const warnings:string[]=[];
    const sourceResults=await Promise.all(cnjs.map(async cnj=>{
      // Para páginas adicionais do DJEN, não repetir toda a consulta DataJud.
      const [djResult,djenResult]=await Promise.allSettled([
        page===1?requestDataJudWithCapacity(cnj,true,45_000):Promise.resolve(null),
        fetchDjenComunicacoes(cnj,{dataInicio:'2000-01-01',cloudBudget:true,pagina:page,forceRefresh})
      ]);
      const source:ProcessTimelineSource={cnj,linked:cnj!==main,movimentos:[],comunicacoes:[]};
      let officialSuccess=false;
      let datajudOk=false;
      let djenOk=false;
      const datajudStatus=page===1
        ?getProcessDataJudStatus(djResult.status==='fulfilled'?djResult.value:undefined,cnj)
        :'not_queried' as const;
      if(page===1){
        if(datajudStatus==='confirmed'&&djResult.status==='fulfilled'){
          officialSuccess=true;
          datajudOk=true;
          source.movimentos=Array.isArray(djResult.value.movimentos)?djResult.value.movimentos:[];
          source.classe=String(djResult.value.classe||'');
        }else if(datajudStatus==='mismatch'){
          warnings.push('DataJud devolveu CNJ divergente para '+formatCnj(cnj)+'; dados rejeitados.');
        }else if(datajudStatus==='not_found'){
          warnings.push('DataJud não encontrou '+formatCnj(cnj)+' no índice atual; isso não significa ausência de movimentos no tribunal.');
        }else{
          // Respeitar cooldown por tribunal; o DJEN continua independente.
          warnings.push('DataJud pendente para '+formatCnj(cnj)+': '+
            (djResult.status==='rejected'?'Falha na chamada DataJud.':
              String(djResult.value?.message||'Fonte sem resposta confirmada.')));
        }
      }
      let count=0;
      if(djenResult.status==='fulfilled'&&djenResult.value?.success){
        const djen=djenResult.value;
        officialSuccess=true;
        djenOk=true;
        source.comunicacoes=djen.items||[];
        count=Number(djen.count)||source.comunicacoes.length;
      }else{
        warnings.push('DJEN indisponível para '+formatCnj(cnj)+': '+
          (djenResult.status==='rejected'?String(djenResult.reason):String(djenResult.value?.error||'sem resposta')));
      }
      return {source,count,officialSuccess,datajudOk,djenOk,datajudStatus};
    }));

    const sources=sourceResults.map(x=>x.source);
    const liveConfirmed=sourceResults.some(x=>x.officialSuccess);
    let archivedEntries:ProcessTimelineEntry[]=[];
    let archivedCheckedAt:string|undefined;
    // A aba Mov. lê a cronologia persistida automaticamente pelo Hermes se a
    // fonte falhar agora. O cache nunca é promovido a consulta nova do tribunal.
    if(page===1 && (!sourceResults[0]?.datajudOk || !sourceResults[0]?.djenOk)){
      const {data:scan,error:scanError}=await db.from('hermes_portfolio_scans')
        .select('events,checked_at')
        .eq('empresa_id',ctx.empresa_id).eq('processo_id',found.id).maybeSingle();
      if(!scanError && scan){
        const saved=recoverHermesTimelineSource(main,scan.events,{
          datajudOk:sourceResults[0]?.datajudOk===true,
          djenOk:sourceResults[0]?.djenOk===true,
        });
        if(saved){
          archivedEntries=buildProcessTimeline(main,[saved.source]);
          if(archivedEntries.length){
            archivedCheckedAt=scan.checked_at||undefined;
            warnings.push('Há eventos do histórico Hermes salvo; a fonte correspondente não respondeu na consulta atual. Confirme atos críticos diretamente no tribunal.');
          }
        }
      }
    }
    // Não afirmar consulta nova quando nenhuma fonte respondeu. O histórico
    // verificado anteriormente é legível, mas claramente sinalizado como salvo.
    if(!liveConfirmed && !archivedEntries.length){
      return {
        success:false,entries:[],page,totalDjen:0,relatedCnjs,hasMore:false,warnings,
        message:'A consulta aos tribunais falhou; exibindo somente o resumo salvo. Clique novamente para tentar ou confira o processo no site do tribunal.'
      };
    }
    const totalDjen=sourceResults.reduce((sum,x)=>sum+x.count,0);
    const hasMore=sourceResults.some(x=>page*DJEN_PER_PAGE<x.count);
    const currentEntries=buildProcessTimeline(main,sources,page===1?{
      ultimoRetorno:String(found.ultimo_retorno||metadata.ultimoRetorno||''),
      observacao:String(found.observacoes||metadata.observacao||''),
      dataDistribuicao:String(metadata.dataDistribuicao||metadata.dataAjuizamento||metadata.data_ajuizamento||''),
      classe:String(metadata.classe_acao||'')
    }:undefined);
    const entries=mergeProcessTimelineEntries(currentEntries,archivedEntries);

    return {
      success:true,entries,page,totalDjen,relatedCnjs,hasMore,
      sourceStatus:{
        datajud:sourceResults[0]?.datajudStatus||'not_queried',
        djen:sourceResults[0]?.djenOk?'confirmed':'unavailable',
      },
      consultadoEm:liveConfirmed?new Date().toISOString():archivedCheckedAt,
      datajudMovements:sources.reduce((sum,source)=>sum+(source.movimentos?.length||0),0),
      djenPublications:sources.reduce((sum,source)=>sum+(source.comunicacoes?.length||0),0),
      warnings,
      message:!liveConfirmed
        ? 'Histórico oficial salvo pelo Hermes. DataJud/DJEN não responderam na consulta atual; verifique a atualização no portal do tribunal.'
        : archivedEntries.length
          ? 'Movimentações atuais e histórico Hermes anterior, preservados separadamente por fonte.'
        : entries.length
        ? 'Movimentações carregadas das fontes oficiais, em ordem cronológica.'
        : warnings.length
          ? 'Não foi possível conferir todas as fontes. Atualize ou consulte o portal do tribunal.'
          : 'Nenhuma movimentação retornada pelas fontes consultadas.'
    };
  }catch(error:any){
    console.error('[processos/movements] Consulta falhou',String(error?.message||error));
    return {success:false,entries:[],message:'Falha ao carregar histórico. Tente novamente.',hasMore:false,page,totalDjen:0,relatedCnjs:[],warnings:[]};
  }
}
