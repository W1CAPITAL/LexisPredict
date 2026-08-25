/**
 * Proteção anti-encerramento indevido.
 * Regra de ouro: scanner/IA NÃO tira caso da carteira ativa.
 * Só humano (viaEncerrarHumano) grava situacao ENCERRADO no gabinete.
 */

const ENC_RE = /ENCERRAD|ARQUIVAD/;

export function isSituacaoEncerradaGabinete(situacao: unknown): boolean {
  return ENC_RE.test(String(situacao || '').toUpperCase());
}

/**
 * Remove do patch qualquer tentativa de fechar carteira via scan/IA.
 * Mantém apenas telemetria: datajud_encerrado_tribunal.
 */
export function sanitizeScanPatchNaoEncerrarCarteira(
  patch: Record<string, any>
): Record<string, any> {
  const out = { ...patch };

  // Nunca gravar situação de gabinete pelo scanner
  delete out.situacao;
  delete out.SITUACAO;
  delete out.statusManual;
  delete out.STATUS_MANUAL;
  if (out.dados && typeof out.dados === 'object') {
    const d = { ...out.dados };
    delete d.situacao;
    delete d.SITUACAO;
    delete d.statusManual;
    delete d.STATUS_MANUAL;
    out.dados = d;
  }

  // Se há sinal de valor residual, NÃO marcar nem baixa automática como "pode arquivar"
  const valorResidual =
    !!out.is_procedente ||
    !!out.sentenca_procedente ||
    out.merito_resultado === 'procedente' ||
    out.merito_resultado === 'parcial' ||
    !!out.sentenca_parcial ||
    !!out.em_cumprimento_sentenca ||
    !!out.cumprimento_ativo ||
    !!out.cumprimento_pendente_necessario;

  if (valorResidual) {
    // Mantém flags de mérito/cumprimento; baixa tribunal pode existir, mas
    // força revisão (não sugerir arquivo cego)
    out.encerrar_carteira_bloqueado = true;
    out.precisa_revisar_encerramento = true;
  }

  return out;
}

/**
 * Bloqueia transição EM ANDAMENTO → ENCERRADO sem flag humana.
 * Retorna situacao final segura + motivo se bloqueou.
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
  const atual = String(opts.situacaoAtual || 'EM ANDAMENTO').toUpperCase();
  const nova = String(opts.situacaoNova || '').toUpperCase();
  const jaEra = ENC_RE.test(atual);
  const querEncerrar = ENC_RE.test(nova);

  if (!querEncerrar) {
    return { situacao: opts.situacaoNova || opts.situacaoAtual || 'EM ANDAMENTO', bloqueado: false };
  }

  // Já era encerrado: pode manter
  if (jaEra) {
    return { situacao: 'ENCERRADO', bloqueado: false };
  }

  // Novo encerramento exige humano
  if (!opts.viaEncerrarHumano) {
    return {
      situacao: opts.situacaoAtual || 'EM ANDAMENTO',
      bloqueado: true,
      motivo: 'Encerramento de carteira bloqueado: só operador humano (botão Encerrar).',
    };
  }

  // Humano tentando encerrar com valor residual — exige force
  const residual =
    !!opts.isProcedente || !!opts.emCumprimento || !!opts.cumprimentoPendente;
  if (residual && !opts.forceMesmoComValor) {
    return {
      situacao: opts.situacaoAtual || 'EM ANDAMENTO',
      bloqueado: true,
      motivo:
        'Há procedente/cumprimento: confirme "forceMesmoComValor" ou reabra e trate antes de encerrar.',
    };
  }

  return { situacao: 'ENCERRADO', bloqueado: false };
}
