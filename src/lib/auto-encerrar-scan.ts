/**
 * Autoencerramento de scanner — DESATIVADO.
 *
 * Regra de segurança: nenhuma ausência de variável, texto, flag ou resultado
 * do tribunal pode encerrar um processo automaticamente nesta versão.
 * A rotina só poderá ser reativada quando houver uma decisão explícita de
 * produto para isso.
 */

export type DecisaoEncerrarScan =
  | { acao: "auto_encerrar"; motivo: string }
  | { acao: "revisao_fila"; motivo: string; prioridade: number }
  | { acao: "nenhuma" };

export function autoEncerrarScanAtivo(): boolean {
  return false;
}

export function decidirEncerramentoScan(_ctx: {
  target: any;
  patch: Record<string, any>;
}): DecisaoEncerrarScan {
  return { acao: "nenhuma" };
}

export function aplicarDecisaoNoPatch(
  patch: Record<string, any>,
  _target: any,
  _decisao: DecisaoEncerrarScan,
): Record<string, any> {
  // Mesmo que algum chamador tente passar uma decisão de autoencerramento,
  // não aplicamos nenhuma alteração de encerramento enquanto o recurso estiver off.
  return { ...patch };
}
