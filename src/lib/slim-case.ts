import type { LegalCase } from "@/lib/case-logic";

/** Enxuga o caso para Server Action (arquivo SEM "use server"). */
export function slimCaseForSave(c: LegalCase): LegalCase {
  const x: any = c || {};
  return {
    ...x,
    protocolo: x.protocolo,
    cliente: x.cliente,
    situacao: x.situacao,
    observacao: x.observacao,
    proximoPrazo: x.proximoPrazo,
    ultimoRetorno: x.ultimoRetorno,
    statusManual: x.statusManual,
    created_by: x.created_by,
    atendido_por: x.atendido_por,
    atendido_em: x.atendido_em,
    escritorio: x.escritorio,
    advogado: x.advogado,
    telefone: x.telefone,
    tribunal: x.tribunal,
  } as LegalCase;
}
