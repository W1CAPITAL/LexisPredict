/**
 * Operações W1 CONTROL / scanner automático — não contam como atendimento de operador.
 */
import { isEmpresaW1Principal, legendaW1Control } from '@/lib/w1-empresa';

export type OperacaoSistema = {
  origem?: string;
  legenda?: string;
  perfil?: string;
  tipo?: string;
};

export function getOperacaoSistemaLabel(
  caseOrDados: any,
  empresaId?: string | null
): string | null {
  const dados =
    caseOrDados?.dados && typeof caseOrDados.dados === 'object'
      ? caseOrDados.dados
      : caseOrDados && typeof caseOrDados === 'object'
        ? caseOrDados
        : {};
  const op = dados.operacao_sistema || caseOrDados?.operacao_sistema;
  const nome = dados.auditado_por_nome || caseOrDados?.auditado_por_nome;
  const viaScan = !!(dados.via_scan_auto_encerrar || caseOrDados?.via_scan_auto_encerrar);
  const emp =
    empresaId ||
    caseOrDados?.empresa_id ||
    dados.empresa_id ||
    null;

  if (
    viaScan ||
    nome === 'W1 CONTROL' ||
    op?.origem === 'W1_CONTROL' ||
    op?.perfil === 'W1 CONTROL' ||
    op?.tipo === 'SCAN_AUTO_ENCERRAR'
  ) {
    if (dados.auditado_legenda && isEmpresaW1Principal(emp)) return String(dados.auditado_legenda);
    if (op?.legenda && isEmpresaW1Principal(emp)) return String(op.legenda);
    return legendaW1Control(emp);
  }
  return null;
}

export function isOperacaoSistemaW1(caseOrDados: any): boolean {
  return !!getOperacaoSistemaLabel(caseOrDados);
}

export function isEncerradoPeloScanner(caseOrDados: any): boolean {
  const d =
    caseOrDados?.dados && typeof caseOrDados.dados === 'object'
      ? caseOrDados.dados
      : {};
  return !!(
    caseOrDados?.via_scan_auto_encerrar ||
    d.via_scan_auto_encerrar ||
    caseOrDados?.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR' ||
    d.operacao_sistema?.tipo === 'SCAN_AUTO_ENCERRAR'
  );
}
