'use server';

import {
 loadAtividadesRegistradasKpi,
 type AtividadeResponsavelKpi,
} from '@/lib/atividades-kpi-service';

export type {AtividadeResponsavelKpi};

/** Compatibilidade com componentes antigos; ambas as rotas usam a mesma consulta autenticada. */
export async function getAtividadesRegistradasCountAction():Promise<
 {ok:true;count:number;responsaveis:AtividadeResponsavelKpi[]}
 | {ok:false;count:null;responsaveis:[]}
>{
 const result=await loadAtividadesRegistradasKpi();
 return result.ok?result:{ok:false,count:null,responsaveis:[]};
}
