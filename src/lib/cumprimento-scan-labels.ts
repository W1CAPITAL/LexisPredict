/**
 * Rótulos operacionais do scanner em escopo cumprimento (feed + UI).
 */
export function labelResultadoCumprimentoScan(patch: Record<string, any> | null | undefined): string {
  if (!patch) return 'SEM RESULTADO';
  const d = patch.dados && typeof patch.dados === 'object' ? patch.dados : {};
  const em =
    !!patch.em_cumprimento_sentenca ||
    !!d.em_cumprimento_sentenca ||
    d.status_executivo === 'ativo';
  if (em) return 'JÁ EM CUMPRIMENTO';

  const pend =
    patch.cumprimento_pendente_necessario === true ||
    d.cumprimento_pendente_necessario === true ||
    d.status_executivo === 'pendente';
  if (pend) return 'PENDENTE INSTAURAR';

  const score = Number(patch.oportunidade_score ?? d.oportunidade_score ?? patch.oportunidade_instaurar?.score ?? 0);
  const elegivel =
    !!patch.oportunidade_elegivel ||
    !!d.oportunidade_elegivel ||
    !!patch.oportunidade_instaurar?.elegivel;
  const acima =
    !!patch.acima_limiar_cobranca ||
    !!d.acima_limiar_cobranca ||
    (elegivel && score >= 55);

  if (patch.declaratorio_sem_quantia || d.declaratorio_sem_quantia) {
    return 'SEM CRÉDITO · declaratório sem quantia';
  }
  const merito = String(patch.merito_tipo || d.merito_tipo || '').toLowerCase();
  if (merito === 'improcedente' || (patch.is_procedente === false && merito === 'improcedente')) {
    return 'SEM CRÉDITO · improcedente';
  }
  if (acima) {
    const tipo = String(patch.oportunidade_tipo_credito || d.oportunidade_tipo_credito || patch.oportunidade_instaurar?.tipo_credito || '').toLowerCase();
    return `ELEGÍVEL HONORÁRIOS · score ${score}${tipo && tipo !== 'incerto' ? ` · ${tipo}` : ''}`;
  }
  if (patch.is_procedente || d.is_procedente || merito === 'procedente' || merito === 'parcial') {
    return `PROCEDENTE${score > 0 ? ` · score ${score}` : ''} · triagem`;
  }
  if (patch.datajud_encerrado_tribunal) return 'BAIXA/TRÂNSITO · checar cumprimento';
  return 'MONITORADO';
}

/** true se ainda não há definição de pendência de cumprimento (precisa reauditar). */
export function cumprimentoPendenteIndefinido(c: {
  cumprimento_pendente_necessario?: boolean | null;
  em_cumprimento_sentenca?: boolean | null;
  dados?: any;
}): boolean {
  if (c.em_cumprimento_sentenca) return false;
  if (c.dados?.em_cumprimento_sentenca) return false;
  const v = c.cumprimento_pendente_necessario;
  if (v === true || v === false) return false;
  const vd = c.dados?.cumprimento_pendente_necessario;
  if (vd === true || vd === false) return false;
  return true;
}
