import {getSupabaseAdmin,getUserContext} from '@/lib/server-db';
import {getAtividadesRegistradasPorResponsavel,type AtividadesResponsavelResumo} from '@/lib/atividades-registradas';

export type AtividadeResponsavelKpi=AtividadesResponsavelResumo & {
 userId:string;
 nome:string;
};

export type AtividadesKpiResult=
 | {ok:true;count:number;responsaveis:AtividadeResponsavelKpi[]}
 | {ok:false;reason:'unauthenticated'|'unavailable'};

/**
 * Mesma fonte de dados em desenvolvimento web e no EXE local Next standalone.
 * A empresa vem SOMENTE da sessão validada, nunca de um parâmetro do cliente.
 * Sem service-role no Windows: consultas passam pelas RLS do Supabase.
 */
export async function loadAtividadesRegistradasKpi():Promise<AtividadesKpiResult>{
 try{
  const ctx=await getUserContext();
  if(!ctx.auth_id||!ctx.empresa_id)return {ok:false,reason:'unauthenticated'};
  const empresaId=String(ctx.empresa_id);
  const resumo=await getAtividadesRegistradasPorResponsavel(empresaId);
  const ids=Object.keys(resumo).filter(id=>resumo[id]?.registros>0);
  if(!ids.length)return {ok:true,count:0,responsaveis:[]};
  const db=await getSupabaseAdmin();
  const {data:profiles,error}=await db.from('usuarios')
   .select('auth_user_id,nome').eq('empresa_id',empresaId).in('auth_user_id',ids);
  if(error)throw Error('Falha ao consultar responsáveis: '+error.message);
  const names=new Map<string,string>(
   (profiles||[]).map(p=>[String(p.auth_user_id),String(p.nome||'Usuário sem nome')] as const)
  );
  const responsaveis:AtividadeResponsavelKpi[]=ids.map(userId=>({
   userId,nome:names.get(userId)||'Usuário sem nome',...resumo[userId]
  })).sort((a,b)=>b.registros-a.registros||a.nome.localeCompare(b.nome,'pt-BR'));
  return {
   ok:true,count:responsaveis.reduce((sum,item)=>sum+item.registros,0),
   responsaveis
  };
 }catch(error){
  console.error('[atividades-kpi] consulta por empresa falhou',error);
  return {ok:false,reason:'unavailable'};
 }
}
