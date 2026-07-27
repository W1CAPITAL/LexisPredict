/**
 * @fileOverview Motor de Authority Score v1.0 ELITE
 * Calcula a pontuação técnica do advogado isolando falhas do cliente.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital
 */

import { LegalCase } from "./case-logic";

export interface ScoreDetail {
  protocolo: string;
  cliente: string;
  tipoFalha: string;
  peso: number;
  trecho: string;
}

export interface LawyerScoreResult {
  score: number;
  totalCasos: number;
  falhasFormaisGraves: number;
  redistribuicoes: number;
  resultadosAdversos: number;
  prazosVencidosAtribuiveis: number;
  falhasClienteIgnoradas: number;
  casosMistos: number;
  detalhes: ScoreDetail[];
}

/**
 * Normaliza texto para busca sem acentos
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function calcularScoreAdvogado(casos: LegalCase[]): LawyerScoreResult {
  const result: LawyerScoreResult = {
    score: 100,
    totalCasos: casos.length,
    falhasFormaisGraves: 0,
    redistribuicoes: 0,
    resultadosAdversos: 0,
    prazosVencidosAtribuiveis: 0,
    falhasClienteIgnoradas: 0,
    casosMistos: 0,
    detalhes: []
  };

  if (casos.length === 0) return result;

  let totalPenalties = 0;

  // REGEX DE CLASSIFICAÇÃO
  const regexCliente = /(cliente.*nao.*resp|cliente.*sumiu|sem.*retorno.*cliente|nao.*enviou.*doc|nao.*mandou.*doc|nao.*pagou.*custas|custas.*pendentes.*cliente|cliente.*se.*negou)/i;
  
  const regexFormal = /(selo.*procur|procur.*inv|indefer.*inicial|peticao.*indefer|falta.*emenda|nao.*emendou|extinto.*falta.*emenda|cancelada.*distrib|cancelamento.*distrib)/i;
  
  const regexRedistrib = /(redistrib|incompet|distribuido.*errado|ofertada.*redistrib)/i;
  
  const regexAdverso = /(improced|sucumb|honorario)/i;

  casos.forEach(c => {
    const text = normalizeText(`${c.observacao || ''} ${c.situacao || ''} ${c.status || ''}`);
    const isClientFault = regexCliente.test(text);
    let penaltyForThisCase = 0;
    let faultType = "";
    let matchSnippet = "";

    // 1. Verificar Falha Formal Grave
    if (regexFormal.test(text)) {
      const weight = 20;
      const isMixed = isClientFault;
      const finalWeight = isMixed ? weight * 0.5 : weight;
      
      totalPenalties += finalWeight;
      result.falhasFormaisGraves++;
      if (isMixed) result.casosMistos++;
      
      faultType = isMixed ? "Formal (Mista)" : "Formal Grave";
      penaltyForThisCase = finalWeight;
      matchSnippet = text.match(regexFormal)?.[0] || "Falha de peça/selo";
    } 
    // 2. Verificar Redistribuição
    else if (regexRedistrib.test(text)) {
      const weight = 15;
      totalPenalties += weight;
      result.redistribuicoes++;
      faultType = "Erro de Distribuição";
      penaltyForThisCase = weight;
      matchSnippet = text.match(regexRedistrib)?.[0] || "Redistribuição";
    }
    // 3. Verificar Resultado Adverso
    else if (regexAdverso.test(text)) {
      const weight = 10;
      totalPenalties += weight;
      result.resultadosAdversos++;
      faultType = "Resultado Adverso";
      penaltyForThisCase = weight;
      matchSnippet = text.match(regexAdverso)?.[0] || "Improcedência";
    }
    // 4. Prazos Vencidos Atribuíveis
    else if (c.status === 'Vencido' && !isClientFault) {
      const weight = 8;
      totalPenalties += weight;
      result.prazosVencidosAtribuiveis++;
      faultType = "Prazo Vencido (Banca)";
      penaltyForThisCase = weight;
      matchSnippet = "Vencimento sem justificativa de cliente";
    }

    // Registrar detalhes se houve falha
    if (penaltyForThisCase > 0) {
      result.detalhes.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipoFalha: faultType,
        peso: penaltyForThisCase,
        trecho: matchSnippet
      });
    }

    // Contar falhas de cliente ignoradas (estatístico)
    if (isClientFault && penaltyForThisCase === 0) {
      result.falhasClienteIgnoradas++;
    }
  });

  // Cálculo final do Score (0-100)
  // Penalidade média por volume para não zerar com 5 casos em 1000
  // Mas aqui usaremos a regra solicitada de peso direto, limitada a 0.
  result.score = Math.max(0, 100 - totalPenalties);

  return result;
}
