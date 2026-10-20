import { getSupabaseAdmin } from "@/lib/server-db";

export type AnalisesResumo = {
  totalRegistros: number;
  processosAnalisados: number;
  atendidosInternamenteNoPeriodo: number;
  auditoriaSistemica: number;
  auditoriaDocumental: number;
  triagemReplicaProvas: number;
  dossiesIndividuais: number;
  investigacoesExternas: number;
  projetos: number;
  responsavel: string;
  consultaEm: string;
};
export const EMPTY_ANALISES: AnalisesResumo = {
  totalRegistros:0,processosAnalisados:0,atendidosInternamenteNoPeriodo:0,
  auditoriaSistemica:0,auditoriaDocumental:0,triagemReplicaProvas:0,
  dossiesIndividuais:0,investigacoesExternas:0,projetos:0,
  responsavel:"Davi Alves Figueredo",consultaEm:""
};
type Row = {
  processo_id:number|null; protocolo_ref:string; categoria:string;
  data_atividade:string; responsavel_nome:string;
};
// RLS fechada para acesso browser. Consulta somente no servidor, com empresa da sessão validada.
export async function getResumoAnalisesDaEmpresa(
  empresaId:string,
  inicio?:string,
  fim?:string
):Promise<AnalisesResumo> {
  const admin=await getSupabaseAdmin();
  const rows:Row[]=[];
  for(let from=0; from<15000; from+=700){
    const {data,error}=await admin.from("registros_trabalho_analitico")
      .select("processo_id,protocolo_ref,categoria,data_atividade,responsavel_nome")
      .eq("empresa_id",empresaId)
      .order("id",{ascending:true})
      .range(from,from+699);
    if(error)throw error;
    rows.push(...((data||[]) as Row[]));
    if((data||[]).length<700)break;
  }
  const types=(name:string)=>rows.filter(x=>x.categoria===name).length;
  const cases=rows.filter(x=>x.processo_id!=null);
  const periodo=cases.filter(x=>(!inicio||x.data_atividade>=inicio)&&(!fim||x.data_atividade<=fim));
  return {
    totalRegistros:rows.length,
    processosAnalisados:new Set(cases.map(x=>x.processo_id)).size,
    atendidosInternamenteNoPeriodo:new Set(periodo.map(x=>x.processo_id)).size,
    auditoriaSistemica:types("auditoria_sistemica"),
    auditoriaDocumental:types("auditoria_documental"),
    triagemReplicaProvas:types("triagem_replica_provas"),
    dossiesIndividuais:types("dossie_individual"),
    investigacoesExternas:types("investigacao_get")+types("investigacao_externa"),
    projetos:types("entrega_projeto"),
    responsavel:"Davi Alves Figueredo",
    consultaEm:new Date().toISOString()
  };
}
