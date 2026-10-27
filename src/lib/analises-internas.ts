import { getSupabaseAdmin } from "@/lib/server-db";

export type AnalisesResumo = {
 totalRegistros:number;
 processosAnalisados:number;
 processosComTrabalhoDavi:number;
 atendidosInternamenteNoPeriodo:number;
 auditoriaSistemica:number;
 auditoriaDocumental:number;
 triagemReplicaProvas:number;
 dossiesIndividuais:number;
 investigacoesExternas:number;
 projetos:number;
 historicoAtendimentosDavi:number;
 historicoEdicoesDavi:number;
 encerramentosSistemicosDavi:number;
 tarefasConcluidas:number;
 tarefasConcluidasPeriodo:number;
 tarefasDaviConcluidas:number;
 tarefasDaviPeriodo:number;
 contatosDeclaradosPeriodo:number;
 tarefasPorPessoa:Array<{nome:string;total:number;periodo:number}>;
 responsavel:string;
 consultaEm:string;
};
export const EMPTY_ANALISES:AnalisesResumo={
 totalRegistros:0,processosAnalisados:0,processosComTrabalhoDavi:0,atendidosInternamenteNoPeriodo:0,
 auditoriaSistemica:0,auditoriaDocumental:0,triagemReplicaProvas:0,dossiesIndividuais:0,
 investigacoesExternas:0,projetos:0,historicoAtendimentosDavi:0,historicoEdicoesDavi:0,
 encerramentosSistemicosDavi:0,tarefasConcluidas:0,tarefasConcluidasPeriodo:0,
 tarefasDaviConcluidas:0,tarefasDaviPeriodo:0,contatosDeclaradosPeriodo:0,
 tarefasPorPessoa:[],responsavel:"Davi Alves Figueredo",consultaEm:""
};
type Analysis={
 processo_id:number|null;protocolo_ref:string;categoria:string;data_atividade:string;
 metadata?:Record<string,unknown>;
};
type Task={
 responsavel_auth_user_id:string;processo_id:number|null;
 data_realizacao:string;contato_cliente_confirmado:boolean;
};
const DAVI_AUTH="4581d2fe-c358-45f9-a1bd-f90f93dce0fc";
const ANALISE_TIPOS=new Set([
 "auditoria_sistemica","auditoria_documental","triagem_replica_provas",
 "dossie_individual","investigacao_get","investigacao_externa"
]);
const IGNORA_PERIODO=new Set(["auditoria_sistemica","historico_encerramento_lote_id_davi"]);
async function paginate<T>(build:(from:number,to:number)=>any):Promise<T[]>{
 const all:T[]=[];
 for(let from=0;from<50000;from+=700){
  const {data,error}=await build(from,from+699);
  if(error)throw error;
  const arr=(data||[]) as T[];
  all.push(...arr);
  if(arr.length<700)break;
 }
 return all;
}
// Fonte de verdade dos KPIs de trabalho interno e tarefas; nunca modifica retorno real ao cliente.
export async function getResumoAnalisesDaEmpresa(
 empresaId:string,inicio?:string,fim?:string
):Promise<AnalisesResumo>{
 const db=await getSupabaseAdmin();
 const [rows,tasks,users]=await Promise.all([
  paginate<Analysis>((a,b)=>db.from("registros_trabalho_analitico")
   .select("processo_id,protocolo_ref,categoria,data_atividade,metadata")
   .eq("empresa_id",empresaId).order("id",{ascending:true}).range(a,b)),
  paginate<Task>((a,b)=>db.from("tarefas_realizadas")
   .select("responsavel_auth_user_id,processo_id,data_realizacao,contato_cliente_confirmado")
   .eq("empresa_id",empresaId).order("id",{ascending:true}).range(a,b)),
  db.from("usuarios").select("auth_user_id,nome").eq("empresa_id",empresaId)
 ]);
 if(users.error)throw users.error;
 const nomes=new Map((users.data||[]).map(u=>[String(u.auth_user_id),String(u.nome||"Usuário")]));
 const inPeriod=(day:string)=>!!day&&(!inicio||day>=inicio)&&(!fim||day<=fim);
 const typeCount=(name:string)=>rows.filter(x=>x.categoria===name).length;
 const analyses=rows.filter(x=>ANALISE_TIPOS.has(x.categoria)&&x.processo_id!=null);
 const works=rows.filter(x=>x.processo_id!=null);
 const periodo=rows.filter(x=>x.processo_id!=null&&inPeriod(x.data_atividade)
  &&!IGNORA_PERIODO.has(x.categoria)
  &&x.metadata?.data_original_ausente!==true);
 const tarefasPorPessoa=[...new Set(tasks.map(t=>t.responsavel_auth_user_id))].map(user=>{
  const m=tasks.filter(t=>t.responsavel_auth_user_id===user);
  return {nome:nomes.get(user)||"Usuário",total:m.length,periodo:m.filter(x=>inPeriod(x.data_realizacao)).length};
 }).sort((a,b)=>b.periodo-a.periodo);
 const daDavi=tasks.filter(x=>x.responsavel_auth_user_id===DAVI_AUTH);
 return {
  totalRegistros:rows.length,
  processosAnalisados:new Set(analyses.map(x=>x.processo_id)).size,
  processosComTrabalhoDavi:new Set(works.map(x=>x.processo_id)).size,
  atendidosInternamenteNoPeriodo:new Set(periodo.map(x=>x.processo_id)).size,
  auditoriaSistemica:typeCount("auditoria_sistemica"),
  auditoriaDocumental:typeCount("auditoria_documental"),
  triagemReplicaProvas:typeCount("triagem_replica_provas"),
  dossiesIndividuais:typeCount("dossie_individual"),
  investigacoesExternas:typeCount("investigacao_get")+typeCount("investigacao_externa"),
  projetos:typeCount("entrega_projeto"),
  historicoAtendimentosDavi:typeCount("historico_atendimento_id_davi")+typeCount("atendimento_por_perfil_davi"),
  historicoEdicoesDavi:typeCount("historico_edicao_id_davi")+typeCount("edicao_por_nome_davi"),
  encerramentosSistemicosDavi:typeCount("historico_encerramento_lote_id_davi"),
  tarefasConcluidas:tasks.length,
  tarefasConcluidasPeriodo:tasks.filter(x=>inPeriod(x.data_realizacao)).length,
  tarefasDaviConcluidas:daDavi.length,
  tarefasDaviPeriodo:daDavi.filter(x=>inPeriod(x.data_realizacao)).length,
  contatosDeclaradosPeriodo:tasks.filter(x=>inPeriod(x.data_realizacao)&&x.contato_cliente_confirmado).length,
  tarefasPorPessoa,
  responsavel:"Davi Alves Figueredo",consultaEm:new Date().toISOString()
 };
}


/**
 * Totais privados da aba /analises-internas. A autoria é obtida exclusivamente
 * da sessão autenticada no servidor, nunca de parâmetros recebidos da interface.
 * Não reutilizar getResumoAnalisesDaEmpresa(): aquele é gerencial e inclui
 * registros de toda a equipe.
 */
export async function getResumoAnalisesDoUsuario(
 empresaId:string,authUserId:string
):Promise<Pick<AnalisesResumo,"totalRegistros"|"processosAnalisados"|"auditoriaDocumental"|"triagemReplicaProvas"|"investigacoesExternas">>{
 if(!empresaId||!authUserId)throw new Error("Identidade necessária para consultar análises");
 const db=await getSupabaseAdmin();
 const rows=await paginate<Pick<Analysis,"processo_id"|"categoria">>((a,b)=>
  db.from("registros_trabalho_analitico")
   .select("processo_id,categoria")
   .eq("empresa_id",empresaId)
   .eq("responsavel_auth_user_id",authUserId)
   .order("id",{ascending:true})
   .range(a,b)
 );
 const typeCount=(name:string)=>rows.filter(row=>row.categoria===name).length;
 return {
  totalRegistros:rows.length,
  processosAnalisados:new Set(rows.filter(row=>ANALISE_TIPOS.has(row.categoria)&&row.processo_id!=null).map(row=>row.processo_id)).size,
  auditoriaDocumental:typeCount("auditoria_documental"),
  triagemReplicaProvas:typeCount("triagem_replica_provas"),
  investigacoesExternas:typeCount("investigacao_get")+typeCount("investigacao_externa")
 };
}
