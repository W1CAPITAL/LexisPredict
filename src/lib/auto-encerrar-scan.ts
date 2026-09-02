/**
 * Motor de autoencerramento do scanner.
 *
 * O recurso fica bloqueado por padrão e só pode ser reativado posteriormente
 * por alteração explícita de código/configuração. Nesta versão todas as
 * decisões retornam "nenhuma" e nenhum patch de encerramento é aplicado.
 */

export type DecisaoEncerrarScan =
  | { acao: "auto_encerrar"; motivo: string }
  | { acao: "revisao_fila"; motivo: string; prioridade: number }
  | { acao: "nenhuma" };

export function autoEncerrarScanAtivo(): false {
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
  return { ...patch };
}
