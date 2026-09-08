/**
 * Scanner NÃO encerra carteira e NÃO mexe no dono.
 * Tribunal baixa = flag datajud + fila "Encerrados a revisar".
 */

const ENC_RE = /ENCERRAD|ARQUIVAD/;

export function isSituacaoEncerradaGabinete(situacao: unknown): boolean {
  return ENC_RE.test(String(situacao || '').toUpperCase());
}

export function sanitizeScanPatchNaoEncerrarCarteira(
  patch: Record<string, any>
): Record<string, any> {
  const out = { ...patch };
  delete out.created_by;
  delete out.createdBy;
  delete out.atendido_por;
  delete out.via_scan_auto_encerrar;
  delete out.scan_auto_encerrar_motivo;
  delete out.scan_auto_encerrado_em;
  if (out.dados && typeof out.dados === 'object') {
    const d = { ...out.dados };
    delete d.created_by;
    delete d.via_scan_auto_encerrar;
    delete d.scan_auto_encerrar_motivo;
    out.dados = d;
  }
  if (ENC_RE.test(String(out.situacao || '').toUpperCase()) && !out.viaEncerrarHumano) {
    delete out.situacao;
    delete out.statusManual;
    delete out.status_interno;
  }
  if (/ARQUIVAD|ENCERRAD/i.test(String(out.status || '')) && !out.viaEncerrarHumano) {
    delete out.status;
  }
  out.precisa_revisar_encerramento = !!(
    out.precisa_revisar_encerramento ||
    out.datajud_encerrado_tribunal
  );
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
  const atual = String(opts.situacaoAtual || 'EM ANDAMENTO');
  const nova = String(opts.situacaoNova || atual);
  const querFechar = ENC_RE.test(nova.toUpperCase());
  if (querFechar && !opts.viaEncerrarHumano) {
    return { situacao: atual || 'EM ANDAMENTO', bloqueado: true, motivo: 'só humano encerra carteira' };
  }
  return { situacao: nova, bloqueado: false };
}
