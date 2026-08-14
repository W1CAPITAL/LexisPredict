/**
 * Conhecimento determinístico CPC / STJ para fila de cumprimento e rascunhos.
 * Inspirado no princípio de "fonte antes da afirmação" (advocacia-aberta):
 * trechos curtos, citáveis, sem inventar valor de honorários.
 */
export const CONHECIMENTO_CUMPRIMENTO_HONORARIOS = {
  art523: {
    referencia: 'Art. 523, §1º, CPC',
    texto:
      'Não ocorrendo pagamento voluntário no prazo de 15 (quinze) dias, o débito será acrescido de multa de dez por cento e, também, de honorários de advogado de dez por cento.',
  },
  sumula517: {
    referencia: 'Súmula 517 do STJ',
    texto:
      'São devidos honorários advocatícios no cumprimento de sentença, haja ou não impugnação, depois de escoado o prazo para pagamento voluntário, que se inicia após a intimação do advogado da parte executada.',
  },
  guardRail:
    'Não prometa valor em R$ de multa/honorários antes do demonstrativo e da leitura do teor. Use apenas como fundamento jurídico da oportunidade de instaurar.',
} as const;

/** Bloco curto para injetar em prompt de IA / script WhatsApp quando elegível. */
export function blocoFundamentoInstaurarCumprimento(opts?: {
  tipoCredito?: string;
  diasAposTransito?: number | null;
}): string {
  const { art523, sumula517, guardRail } = CONHECIMENTO_CUMPRIMENTO_HONORARIOS;
  const dias =
    opts?.diasAposTransito != null && opts.diasAposTransito > 15
      ? `Já se passaram cerca de ${opts.diasAposTransito} dias desde o trânsito/intimação indexada.`
      : 'Verificar se já escoaram os 15 dias do pagamento voluntário (art. 523).';
  const tipo =
    opts?.tipoCredito === 'sucumbencia'
      ? 'Foco possível: honorários de sucumbência (legitimidade do advogado).'
      : opts?.tipoCredito === 'ambos'
        ? 'Pode haver crédito do cliente e honorários de sucumbência — separar no demonstrativo.'
        : 'Foco: obrigação principal do título (crédito do cliente), se houver quantia.';
  return [
    `Fundamento (não é cálculo):`,
    `- ${art523.referencia}: ${art523.texto}`,
    `- ${sumula517.referencia}: ${sumula517.texto}`,
    dias,
    tipo,
    `⚠️ ${guardRail}`,
  ].join('\n');
}
