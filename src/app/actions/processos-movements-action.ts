'use server';

/**
 * Histórico detalhado para o inspetor /processos. Consultado somente quando a aba Mov. abre.
 * Nunca correlacionar cumprimento por simples semelhança de nome/parte.
 */
import { getSupabaseAdmin, getUserContext } from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { fetchDjenComunicacoes } from '@/lib/djen';
import {
  buildProcessTimeline, cnjDigits, formatCnj, linkedCumprimentoCnjs,
  type ProcessTimelineSource
} from '@/lib/processos-timeline';

const MAX_PAGE=200;
const DJEN_PER_PAGE=50;

export async function fetchProcessosMovementsAction(recordId:string, requestedCnj:string, requestedPage=1, forceRefresh=false){
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
        page===1?fetchDataJud(cnj,1,{fast:true,cloudBudget:true,forceRefresh}):Promise.resolve(null),
        fetchDjenComunicacoes(cnj,{dataInicio:'2000-01-01',cloudBudget:true,pagina:page,forceRefresh})
      ]);
      const source:ProcessTimelineSource={cnj,linked:cnj!==main,movimentos:[],comunicacoes:[]};
      if(page===1){
        if(djResult.status==='fulfilled'&&djResult.value&&!djResult.value.error){
          if(cnjDigits(djResult.value.numeroProcesso)===cnj){
            source.movimentos=Array.isArray(djResult.value.movimentos)?djResult.value.movimentos:[];
            source.classe=String(djResult.value.classe||'');
          }else warnings.push('DataJud retornou número divergente para '+formatCnj(cnj)+'; dados descartados.');
        }else{
          warnings.push('DataJud indisponível para '+formatCnj(cnj)+': '+
            (djResult.status==='rejected'?String(djResult.reason):String(djResult.value?.message||'sem resposta')));
        }
      }
      let count=0;
      if(djenResult.status==='fulfilled'&&djenResult.value?.success){
        const djen=djenResult.value;
        source.comunicacoes=djen.items||[];
        count=Number(djen.count)||source.comunicacoes.length;
      }else{
        warnings.push('DJEN indisponível para '+formatCnj(cnj)+': '+
          (djenResult.status==='rejected'?String(djenResult.reason):String(djenResult.value?.error||'sem resposta')));
      }
      return {source,count};
    }));

    const sources=sourceResults.map(x=>x.source);
    const totalDjen=sourceResults.reduce((sum,x)=>sum+x.count,0);
    const hasMore=sourceResults.some(x=>page*DJEN_PER_PAGE<x.count);
    const entries=buildProcessTimeline(main,sources,page===1?{
      ultimoRetorno:String(found.ultimo_retorno||metadata.ultimoRetorno||''),
      observacao:String(found.observacoes||metadata.observacao||''),
      dataDistribuicao:String(metadata.dataDistribuicao||metadata.dataAjuizamento||metadata.data_ajuizamento||''),
      classe:String(metadata.classe_acao||'')
    }:undefined);

    return {
      success:true,entries,page,totalDjen,relatedCnjs,hasMore,
      consultadoEm:new Date().toISOString(),
      datajudMovements:sources.reduce((sum,source)=>sum+(source.movimentos?.length||0),0),
      djenPublications:sources.reduce((sum,source)=>sum+(source.comunicacoes?.length||0),0),
      warnings,
      message:entries.length
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
