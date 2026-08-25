/**
 * Operações feitas via SQL / W1 CONTROL não contam como atendimento de operador.
 */
export type OperacaoSistema = {
  origem?: string;
  legenda?: string;
  perfil?: string;
  tipo?: string;
};

export function getOperacaoSistemaLabel(caseOrDados: any): string | null {
  const dados =
    caseOrDados?.dados && typeof caseOrDados.dados === "object"
      ? caseOrDados.dados
      : caseOrDados && typeof caseOrDados === "object"
        ? caseOrDados
        : {};
  const op = dados.operacao_sistema || caseOrDados?.operacao_sistema;
  const nome = dados.auditado_por_nome || caseOrDados?.auditado_por_nome;
  if (nome === "W1 CONTROL" || op?.origem === "W1_CONTROL" || op?.perfil === "W1 CONTROL") {
    return dados.auditado_legenda || op?.legenda || "Feito por Davi Alves Figueredo";
  }
  return null;
}

export function isOperacaoSistemaW1(caseOrDados: any): boolean {
  return !!getOperacaoSistemaLabel(caseOrDados);
}
