/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SCORE DUPLO v2.1 - ASSESSOR vs ADVOGADO (COM SCORE NEGATIVO)
 */

import { LegalCase } from "./case-logic";

export interface ScoreDetail {
  protocolo: string;
  cliente: string;
  tipo: string;
  peso: number;
  motivo: string;
}

export interface ScoreResult {
  score: number;
  label: string;
  totalCasos: number;
  penalidades: ScoreDetail[];
  ignoradosCliente: number;
}

function normalize(text: string): string {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Gatilhos de exclusão: Responsabilidade exclusiva do Cliente
const regexCliente = /(cliente.*nao.*resp|cliente.*sumiu|sem.*retorno.*cliente|nao.*enviou.*doc|nao.*mandou.*doc|nao.*pagou.*custas|custas.*pendentes.*cliente|cliente.*se.*negou|falta.*pagamento.*cliente|aguardando.*cliente|cliente.*desist|cliente.*nao.*quer)/i;

/**
 * SCORE ADVOGADO: Foco Técnico/Jurídico
 * Penaliza erros de peça, forma e resultados de mérito.
 */
export function calcularScoreAdvogado(casos: LegalCase[]): ScoreResult {
  const result: ScoreResult = {
    score: 100,
    label: "Técnico",
    totalCasos: casos.length,
    penalidades: [],
    ignoradosCliente: 0
  };

  if (casos.length === 0) return result;
  let penaltySum = 0;

  const regexFormal = /(selo.*procur|procur.*inv|indefer.*inicial|peticao.*indefer|falta.*emenda|nao.*emendou|extinto.*falta.*emenda|cancelada.*distrib|cancelamento.*distrib|baixa.*falha.*peca)/i;
  const regexRedistrib = /(redistrib|incompet|distribuido.*errado|ofertada.*redistrib)/i;
  const regexAdverso = /(improced|sucumb|honorario)/i;

  casos.forEach(c => {
    const text = normalize(`${c.observacao || ''} ${c.situacao || ''} ${c.statusManual || ''}`);
    const isClientFault = regexCliente.test(text);

    if (isClientFault) {
      result.ignoradosCliente++;
    }

    if (regexFormal.test(text)) {
      const p = isClientFault ? 12 : 25; 
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Falha Formal Grave",
        peso: p,
        motivo: text.match(regexFormal)?.[0] || "Erro de peça/forma"
      });
    } else if (regexRedistrib.test(text)) {
      const p = 15;
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Erro de Distribuição",
        peso: p,
        motivo: "Incompetência/Redistribuição técnica"
      });
    } else if (regexAdverso.test(text)) {
      const p = 10;
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Resultado Adverso",
        peso: p,
        motivo: "Improcedência/Sucumbência"
      });
    }
  });

  // Nota pode ser negativa conforme solicitado (ex: -100)
  result.score = 100 - penaltySum;
  return result;
}

/**
 * SCORE ASSESSOR: Foco Operacional/Acompanhamento
 * Penaliza atrasos de retorno, falhas de cadastro e inércia no contato.
 */
export function calcularScoreAssessor(casos: LegalCase[]): ScoreResult {
  const result: ScoreResult = {
    score: 100,
    label: "Operacional",
    totalCasos: casos.length,
    penalidades: [],
    ignoradosCliente: 0
  };

  if (casos.length === 0) return result;
  let penaltySum = 0;

  const regexRotina = /(nao.*ligou|nao.*atualizou|telefone.*errado|atraso.*contato|nao.*cobrou|status.*errado|falha.*acompanhamento)/i;

  casos.forEach(c => {
    const text = normalize(`${c.observacao || ''} ${c.status || ''}`);
    const isClientFault = regexCliente.test(text);

    if (isClientFault) {
      result.ignoradosCliente++;
    }

    if (c.status === 'Vencido' && !isClientFault) {
      const p = 15;
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Retorno Vencido",
        peso: p,
        motivo: "Atraso no contato de acompanhamento"
      });
    } else if (c.status === 'Sem Prazo' && !['ENCERRADO', 'ARQUIVADO'].includes(normalize(c.situacao).toUpperCase())) {
      const p = 10;
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Falha de Cadastro",
        peso: p,
        motivo: "Processo sem data de retorno definida"
      });
    } else if (regexRotina.test(text)) {
      const p = 12;
      penaltySum += p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Erro de Rotina",
        peso: p,
        motivo: text.match(regexRotina)?.[0] || "Falha de acompanhamento"
      });
    }
  });

  // Nota pode ser negativa conforme solicitado (ex: -100)
  result.score = 100 - penaltySum;
  return result;
}
