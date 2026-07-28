/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SCORE INFINITO v3.0 - ACUMULATIVO POR VOLUME E QUALIDADE
 */

import { LegalCase } from "./case-logic";
import { isCasoEncerrado } from "./status-encerrado";

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
 * SCORE ADVOGADO: Foco Técnico/Jurídico (SEM LIMITES)
 */
export function calcularScoreAdvogado(casos: LegalCase[]): ScoreResult {
  const result: ScoreResult = {
    score: 0, // Inicia em 0 para acúmulo infinito
    label: "Authority",
    totalCasos: casos.length,
    penalidades: [],
    ignoradosCliente: 0
  };

  if (casos.length === 0) return result;

  let totalPoints = 0;

  const regexPositivo = /(procedente|vitoria|ganhou|deferido|homologado|acordo|sentenca)/i;
  const regexFormal = /(selo.*procur|procur.*inv|indefer.*inicial|peticao.*indefer|falta.*emenda|nao.*emendou|extinto.*falta.*emenda|cancelada.*distrib|cancelamento.*distrib|baixa.*falha.*peca)/i;
  const regexAdverso = /(improced|sucumb|honorario)/i;

  casos.forEach(c => {
    const text = normalize(`${c.observacao || ''} ${c.situacao || ''} ${c.statusManual || ''}`);
    const isClientFault = regexCliente.test(text);

    if (isClientFault) {
      result.ignoradosCliente++;
    }

    // Ganhos Técnicos
    if (text.includes('procedente') || text.includes('vitoria') || text.includes('homologado')) {
      totalPoints += 50;
    } else if (text.includes('sentenca') || text.includes('despacho')) {
      totalPoints += 15;
    }

    if (c.status === 'No Prazo') {
      totalPoints += 5; // Bônus de higiene
    }

    // Penalidades Técnicas
    if (regexFormal.test(text)) {
      const p = isClientFault ? 20 : 100; // Falha formal grave
      totalPoints -= p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Falha Formal Grave",
        peso: p,
        motivo: "Erro de peça ou documento"
      });
    } else if (regexAdverso.test(text)) {
      const p = isClientFault ? 10 : 50;
      totalPoints -= p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Resultado Adverso",
        peso: p,
        motivo: "Improcedência/Sucumbência"
      });
    }
  });

  result.score = totalPoints;
  return result;
}

/**
 * SCORE ASSESSOR: Foco Operacional/Atendimento (SEM LIMITES)
 */
export function calcularScoreAssessor(casos: LegalCase[]): ScoreResult {
  const result: ScoreResult = {
    score: 0,
    label: "Efficiency",
    totalCasos: casos.length,
    penalidades: [],
    ignoradosCliente: 0
  };

  if (casos.length === 0) return result;
  
  let totalPoints = 0;
  const todayStr = new Date().toLocaleDateString('pt-BR');

  casos.forEach(c => {
    const text = normalize(`${c.observacao || ''} ${c.status || ''}`);
    const isClientFault = regexCliente.test(text);

    if (isClientFault) {
      result.ignoradosCliente++;
    }

    // Ganhos Operacionais
    if (c.ultimoRetorno === todayStr) {
      totalPoints += 25; // Atendimento realizado hoje
    }
    if (isCasoEncerrado(c)) {
      totalPoints += 40; // Resolutividade
    }
    if (c.status === 'No Prazo') {
      totalPoints += 10;
    }

    // Penalidades Operacionais
    if (c.status === 'Vencido' && !isClientFault) {
      const p = 80;
      totalPoints -= p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Retorno Vencido",
        peso: p,
        motivo: "Atraso crítico no contato"
      });
    } else if (c.status === 'Sem Prazo' && !isCasoEncerrado(c)) {
      const p = 40;
      totalPoints -= p;
      result.penalidades.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Falha de Cadastro",
        peso: p,
        motivo: "Processo sem data de retorno"
      });
    }
  });

  result.score = totalPoints;
  return result;
}
