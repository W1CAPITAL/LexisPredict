/**
 * Inteligência de carteira — score de risco e sinais.
 * Inspirado em: zatstanley/veredicta (funil, exposição, SLA, risco, squad)
 *
 * Heurístico (sem ML). Alimenta Fila + Painel.
 */

export type CasoSinal = {
  protocolo?: string;
  fase?: string; // contestacao | sentenca | cumprimento | ba | silencio | etc.
  diasSemMovimento?: number;
  diasSemRetornoCliente?: number;
  temBuscaApreensao?: boolean;
  temBaixaTransito?: boolean;
  temMerito?: boolean; // sentenca, liminar, audiencia
  temPublicacaoDjen?: boolean;
  prazoDias?: number | null; // negativo = vencido
  valorCausa?: number | null;
};

export type ScoreRisco = {
  score: number; // 0–100 (maior = mais crítico)
  nivel: "baixo" | "medio" | "alto" | "critico";
  motivos: string[];
  acaoSugerida: string;
  tempoRetornoEstimadoDias: number | null;
};

export function calcularRisco(c: CasoSinal): ScoreRisco {
  let score = 0;
  const motivos: string[] = [];

  if (c.temBuscaApreensao) {
    score += 40;
    motivos.push("Indício de busca e apreensão");
  }
  if (c.temBaixaTransito) {
    score += 25;
    motivos.push("Baixa / trânsito no tribunal");
  }
  if (c.temMerito) {
    score += 18;
    motivos.push("Movimento de mérito (sentença/liminar/audiência)");
  }
  if (c.temPublicacaoDjen) {
    score += 12;
    motivos.push("Publicação DJEN recente");
  }
  if (c.prazoDias != null && c.prazoDias < 0) {
    score += 20;
    motivos.push(`Prazo vencido há ${Math.abs(c.prazoDias)} dia(s)`);
  } else if (c.prazoDias != null && c.prazoDias <= 3) {
    score += 10;
    motivos.push(`Prazo em ${c.prazoDias} dia(s)`);
  }
  const silencio = c.diasSemMovimento ?? 0;
  if (silencio >= 45) {
    score += 15;
    motivos.push(`Silêncio no tribunal há ${silencio} dias`);
  } else if (silencio >= 20) {
    score += 8;
    motivos.push(`Sem movimento há ${silencio} dias`);
  }
  const semRetorno = c.diasSemRetornoCliente ?? 0;
  if (semRetorno >= 14) {
    score += 10;
    motivos.push(`Sem retorno do cliente há ${semRetorno} dias`);
  }

  score = Math.min(100, score);

  let nivel: ScoreRisco["nivel"] = "baixo";
  if (score >= 70) nivel = "critico";
  else if (score >= 45) nivel = "alto";
  else if (score >= 25) nivel = "medio";

  let acaoSugerida = "Monitorar";
  if (c.temBuscaApreensao) acaoSugerida = "Contatar cliente hoje — risco de BA";
  else if (c.temBaixaTransito) acaoSugerida = "Confirmar baixa/trânsito e orientar cliente";
  else if (c.prazoDias != null && c.prazoDias < 0) acaoSugerida = "Tratar prazo vencido";
  else if (semRetorno >= 14) acaoSugerida = "Retomar contato (WhatsApp/ligação)";
  else if (silencio >= 45) acaoSugerida = "Verificar paralisação / protocolar se cabível";

  // Estimativa rude de retorno: quanto maior o score, mais cedo priorizar
  let tempoRetornoEstimadoDias: number | null = null;
  if (nivel === "critico") tempoRetornoEstimadoDias = 0;
  else if (nivel === "alto") tempoRetornoEstimadoDias = 1;
  else if (nivel === "medio") tempoRetornoEstimadoDias = 3;
  else tempoRetornoEstimadoDias = 7;

  return { score, nivel, motivos, acaoSugerida, tempoRetornoEstimadoDias };
}

export function ranquearPorRisco(casos: CasoSinal[]): Array<CasoSinal & { risco: ScoreRisco }> {
  return casos
    .map((c) => ({ ...c, risco: calcularRisco(c) }))
    .sort((a, b) => b.risco.score - a.risco.score);
}
