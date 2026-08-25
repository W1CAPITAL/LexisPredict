/**
 * Encerramento — versão soft (sem bloqueios duros).
 * Scanner pode auto-encerrar quando a política de auto-encerrar-scan permitir.
 * Dono (created_by) nunca é alterado aqui.
 */

const ENC_RE = /ENCERRAD|ARQUIVAD/;

export function isSituacaoEncerradaGabinete(situacao: unknown): boolean {
  return ENC_RE.test(String(situacao || '').toUpperCase());
}

/**
 * Antes: removia situacao do patch sempre.
 * Agora: deixa passar se via_scan_auto_encerrar ou situacao já vinha do patch seguro.
 * Só limpa tentativa de mudar created_by.
 */
export function sanitizeScanPatchNaoEncerrarCarteira(
  patch: Record<string, any>
): Record<string, any> {
  const out = { ...patch };
  delete out.created_by;
  delete out.atendido_por;

  // Se o lote de auto-encerrar já decidiu, não desfaz
  if (out.via_scan_auto_encerrar || out.dados?.via_scan_auto_encerrar) {
    return out;
  }

  // Revisão: não força ENCERRADO
  if (out.precisa_revisar_encerramento || out.dados?.precisa_revisar_encerramento) {
    // mantém situacao atual se alguém tentou fechar cego
    if (ENC_RE.test(String(out.situacao || '').toUpperCase()) && !out.via_scan_auto_encerrar) {
      delete out.situacao;
      delete out.statusManual;
    }
  }

  return out;
}

/**
 * Soft: NUNCA bloqueia transição. Só anota no retorno se não veio via humano.
 * (bloqueios duros geravam casos “travados” e inconsistência de KPI.)
 */
export function guardTransicaoEncerrarGabinete(opts: {
  situacaoAtual: string;
  situacaoNova: string;
  viaEncerrarHumano?: boolean;
  isProcedente?: boolean;
  emCumprimento?: boolean;
  cumprimentoPendente?: boolean;
  forceMesmoComValor?: boolean;
}): { situacao: string; bloqueado: boolean; motivo?: string } {
  const nova = String(opts.situacaoNova || opts.situacaoAtual || 'EM ANDAMENTO');
  return {
    situacao: nova,
    bloqueado: false,
    motivo: opts.viaEncerrarHumano ? undefined : 'soft-pass',
  };
}
