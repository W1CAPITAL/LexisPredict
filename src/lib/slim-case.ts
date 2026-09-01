import type { LegalCase } from "@/lib/case-logic";

/** Enxuga o caso para Server Action sem perder prazo e movimento tribunal. */
export function slimCaseForSave(c: LegalCase): LegalCase {
  const x: any = c || {};
  return {
    ...x,
    protocolo: x.protocolo,
    cliente: x.cliente,
    situacao: x.situacao,
    observacao: x.observacao,
    proximoPrazo: x.proximoPrazo || x.proximo_retorno || x.proximoRetorno || "",
    proximo_retorno: x.proximoPrazo || x.proximo_retorno || x.proximoRetorno || "",
    ultimoRetorno: x.ultimoRetorno || x.ultimo_retorno || "",
    ultimo_retorno: x.ultimoRetorno || x.ultimo_retorno || "",
    statusManual: x.statusManual,
    created_by: x.created_by,
    atendido_por: x.atendido_por,
    atendido_em: x.atendido_em,
    escritorio: x.escritorio,
    advogado: x.advogado,
    telefone: x.telefone,
    tribunal: x.tribunal,
    datajud_ultimo_movimento: x.datajud_ultimo_movimento,
    datajud_ultimo_nome: x.datajud_ultimo_nome,
    ultimo_movimento: x.ultimo_movimento || x.andamento,
    andamento: x.andamento,
    djen_resumo: x.djen_resumo,
    tem_novo_andamento: x.tem_novo_andamento,
    djen_nova_comunicacao: x.djen_nova_comunicacao,
    tem_atualizacao_pos_retorno: x.tem_atualizacao_pos_retorno,
  } as LegalCase;
}
