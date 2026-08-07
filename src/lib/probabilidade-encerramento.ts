/**
 * @fileOverview Motor de Estimativa de Encerramento v100.0
 * Função pura para cálculo heurístico baseado em padrões textuais e tempo de atraso.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

export function calcularProbabilidadeEncerramento(input: {
  status?: string;
  situacao?: string;
  observacao?: string;
  diasVencidos?: number | null;
}): number {
  const text = `${input.status || ''} ${input.situacao || ''} ${input.observacao || ''}`.toLowerCase();

  // Já finalizado no gabinete
  if (/(encerrado|arquivado|extinto|baixa definitiva|arquivamento definitivo|cancelada distribuição)/.test(text)) {
    return 100;
  }

  let score = 5; // base operacional mínima

  // Acordo / desistência em via de homologação ou arquivamento
  if (/(desistência|desistencia).*(homolog|arquiv)/.test(text) || /\bacordo\b/.test(text)) {
    score += 40;
  }

  // Fase executiva / pagamento
  if (/(cumprimento de sentença|alvará|alvara|levantamento)/.test(text)) {
    score += 22;
  }

  // Mérito decidido
  if (/(improcedente|procedente|parcialmente procedente|sentença|sentenca)/.test(text)) {
    score += 12;
  }

  // Concluso para decisão / julgamento (peso real)
  if (/(concluso|conclusos para julgamento|conclusos para decisão|conclusos para decisao|para julgamento)/.test(text)) {
    score += 18;
  }

  // Inércia do cliente / custas → risco moderado de extinção
  if (/(não pagou as custas|nao pagou as custas|cliente se negou|sem retorno do cliente|abandono de causa|falta de regularização|falta de regularizacao)/.test(text)) {
    score += 12;
  }

  // Recurso pendente ATRASA o fim (não soma positivo)
  if (/(recurso|apelação|apelacao|agravo)/.test(text)) {
    score -= 8;
  }

  // Contestação / início ainda longe do fim
  if (/(contestação|contestacao)/.test(text)) {
    score -= 6;
  }

  // Distribuição recente / fase muito inicial
  if (/(distribuído|distribuido)/.test(text) && !/(redistrib)/.test(text)) {
    score -= 10;
  }

  // Tempo vencido: peso BAIXO (não dominar o score)
  const d = input.diasVencidos ?? 0;
  if (d > 60) score += 8;
  else if (d > 30) score += 5;
  else if (d > 14) score += 3;
  else if (d > 0) score += 1;

  return Math.max(0, Math.min(100, Math.round(score)));
}
