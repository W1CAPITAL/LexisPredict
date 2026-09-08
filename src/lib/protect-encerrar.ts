

const ENC_RE = /ENCERRAD|ARQUIVAD/;

export function isSituacaoEncerradaGabinete(situacao: unknown): boolean {
  return ENC_RE.test(String(situacao || '').toUpperCase());
}

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
