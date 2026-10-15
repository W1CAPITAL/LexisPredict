"use server";

import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

/** Seleção de um único processo: evita cruzar informações de clientes homônimos. */
export type DocumentCase = {
  id: string; cliente: string; cnj: string; cpf: string; rg: string;
  email: string; telefone: string; endereco: string; cep: string;
  nacionalidade: string; estadoCivil: string; profissao: string;
  banco: string; cnpjBanco: string; classeAcao: string;
  comarca: string; tribunal: string; orgaoJulgador: string;
};
export type DocumentCaseOption = Pick<DocumentCase, "id"|"cliente"|"cnj">;

const val = (raw: unknown): string => typeof raw === "string" || typeof raw === "number"
  ? String(raw).trim().slice(0, 500) : "";
function choose(...items: unknown[]): string {
  return items.map(val).find(Boolean) || "";
}
function mapCase(row: any): DocumentCase {
  const d: Record<string, unknown> = row?.dados && typeof row.dados === "object" && !Array.isArray(row.dados) ? row.dados : {};
  return {
    id: String(row.id),
    cliente: choose(row.cliente, d.cliente, d.CLIENTE),
    cnj: choose(row.protocolo_ref, d.protocolo, d.PROTOCOLO),
    cpf: choose(row.cpf, d.cpf, d.CPF),
    rg: choose(d.rg, d.RG),
    email: choose(row.email, d.email, d.EMAIL),
    telefone: choose(row.telefone, d.telefone, d.TELEFONE),
    endereco: choose(d.endereco, d.ENDERECO, d.endereco_cliente),
    cep: choose(d.cep, d.CEP),
    nacionalidade: choose(row.nacionalidade, d.nacionalidade, d.NACIONALIDADE),
    estadoCivil: choose(row.estado_civil, d.estado_civil, d.estadoCivil, d.ESTADO_CIVIL),
    profissao: choose(row.emprego, d.profissao, d.emprego, d.PROFISSAO),
    banco: choose(row.parte_passiva, d.parte_passiva, d.banco, d.BANCO),
    cnpjBanco: choose(row.parte_passiva_cnpj, d.parte_passiva_cnpj, d.cnpjBanco),
    classeAcao: choose(row.classe_acao, d.classe_acao, d.classeAcao, d.tipo_acao),
    comarca: choose(d.comarca, d.COMARCA, d.cidade_comarca),
    tribunal: choose(row.tribunal, d.tribunal, d.TRIBUNAL),
    orgaoJulgador: choose(row.orgao_julgador, d.orgao_julgador, d.vara),
  };
}
async function scope() {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) throw Error("Sua sessão expirou ou a empresa não está vinculada.");
  // O módulo /processos já permite consulta de leitura à carteira da própria empresa.
  return { empresaId: String(ctx.empresa_id), admin: await getSupabaseAdmin() };
}

export async function searchDocumentCasesAction(term: string): Promise<{ok:boolean;options:DocumentCaseOption[];error?:string}> {
  try {
    const q = String(term || "").trim().replace(/[%,()]/g, " ").slice(0, 100);
    if (q.length < 2) {
      const {admin,empresaId} = await scope();
      const {data,error} = await admin.from("processos").select("id,protocolo_ref,dados")
        .eq("empresa_id",empresaId).order("id",{ascending:false}).limit(30);
      if (error) throw Error("Não foi possível listar os clientes.");
      return {ok:true,options:(data||[]).map(mapCase).filter(x=>x.cliente).map(x=>({id:x.id,cliente:x.cliente,cnj:x.cnj}))};
    }
    const {admin,empresaId} = await scope();
    const cols = "id,protocolo_ref,dados";
    const byColumn = (column: string) => admin.from("processos")
      .select(cols).eq("empresa_id",empresaId).ilike(column,"%"+q+"%").limit(25);
    const results = await Promise.all([
      byColumn("dados->>cliente"),
      byColumn("protocolo_ref"),
    ]);
    if (results.every(r => r.error)) throw Error("Pesquisa temporariamente indisponível.");
    const unique = new Map<string,DocumentCaseOption>();
    for (const result of results) for (const row of result.data || []) {
      const item = mapCase(row);
      if (item.cliente && item.cnj) unique.set(item.id,{id:item.id,cliente:item.cliente,cnj:item.cnj});
    }
    const ranked = Array.from(unique.values()).sort((a,b)=>{
      const score=(c:DocumentCaseOption)=>(c.cliente.toLowerCase()===q.toLowerCase()?100:0)+
        (c.cnj.toLowerCase()===q.toLowerCase()?80:0)+
        (c.cliente.toLowerCase().startsWith(q.toLowerCase())?20:0);
      return score(b)-score(a)||a.cliente.localeCompare(b.cliente,"pt-BR");
    });
    return {ok:true,options:ranked.slice(0,40)};
  } catch(error) {
    console.error("[searchDocumentCasesAction]",error);
    return {ok:false,options:[],error:error instanceof Error?error.message:"Erro na busca de clientes."};
  }
}

export async function getDocumentCaseAction(caseId: string): Promise<{ok:boolean;item?:DocumentCase;error?:string}> {
  try {
    const id = String(caseId || "").trim();
    if (!/^\d{1,19}$/.test(id)) return {ok:false,error:"Processo inválido."};
    const {admin,empresaId} = await scope();
    const {data,error} = await admin.from("processos")
      .select("id,protocolo_ref,cpf,email,estado_civil,emprego,nacionalidade,parte_passiva,parte_passiva_cnpj,classe_acao,orgao_julgador,tribunal,telefone,dados")
      .eq("empresa_id",empresaId).eq("id",id).maybeSingle();
    if (error) throw Error("Falha ao carregar processo selecionado.");
    if (!data) return {ok:false,error:"Processo não encontrado na carteira desta empresa."};
    const item = mapCase(data);
    if (!item.cliente) return {ok:false,error:"O registro não possui nome de cliente verificável."};
    return {ok:true,item};
  } catch(error) {
    console.error("[getDocumentCaseAction]",error);
    return {ok:false,error:error instanceof Error?error.message:"Falha ao carregar cliente."};
  }
}
