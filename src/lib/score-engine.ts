
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 * MOTOR DE SCORE INFINITO v4.1 - ACUMULATIVO COM LOGS DE SUCESSO E FALHA
 */

import { LegalCase, isCasoEncerrado } from "./case-logic";

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
  pontos: ScoreDetail[]; 
  ignoradosCliente: number;
}

function normalize(text: string): string {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const regexCliente = /(cliente.*nao.*resp|cliente.*sumiu|sem.*retorno.*cliente|nao.*enviou.*doc|nao.*mandou.*doc|nao.*pagou.*custas|custas.*pendentes.*cliente|cliente.*se.*negou|falta.*pagamento.*cliente|aguardando.*cliente|cliente.*desist|cliente.*nao.*quer)/i;

/**
 * SCORE ADVOGADO: Foco Técnico/Jurídico (SEM LIMITES)
 */
export function calcularScoreAdvogado(casos: LegalCase[]): ScoreResult {
  const result: ScoreResult = {
    score: 0,
    label: "Authority",
    totalCasos: casos.length,
    pontos: [],
    ignoradosCliente: 0
  };

  if (casos.length === 0) return result;

  let totalPoints = 0;

  const regexFormal = /(selo.*procur|procur.*inv|indefer.*inicial|peticao.*indefer|falta.*emenda|nao.*emendou|extinto.*falta.*emenda|cancelada.*distrib|cancelamento.*distrib|baixa.*falha.*peca)/i;
  const regexAdverso = /(improced|sucumb|honorario)/i;

  casos.forEach(c => {
    const text = normalize(`${c.observacao || ''} ${c.situacao || ''} ${c.statusManual || ''}`);
    const isClientFault = regexCliente.test(text);

    if (isClientFault) {
      result.ignoradosCliente++;
    }

    // NUMOPEDE / predatória na carteira do advogado — penaliza ranking
    if ((c as any).sinal_numopede || (c as any).sinal_predatoria) {
      const p = -40;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "NUMOPEDE",
        peso: p,
        motivo: "Menção NUMOPEDE / litigância predatória no processo"
      });
    }

    // --- GANHOS TÉCNICOS ---
    if (text.includes('procedente') || text.includes('vitoria') || text.includes('homologado') || text.includes('acordo') || c.datajud_encerrado_tribunal) {
      const p = 50;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Vitória Técnica",
        peso: p,
        motivo: "Resultado Favorável de Mérito / Acordo"
      });
    }

    if (c.status === 'No Prazo') {
      const p = 5;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Bônus Higiene",
        peso: p,
        motivo: "Manutenção de Prazo Regular"
      });
    }

    // --- PENALIDADES TÉCNICAS ---
    if (regexFormal.test(text)) {
      const p = isClientFault ? -20 : -100; 
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Falha Formal Grave",
        peso: p,
        motivo: isClientFault ? "Erro formal (Mitigado por inércia cliente)" : "Erro crítico de peça ou selagem"
      });
    } else if (regexAdverso.test(text)) {
      const p = isClientFault ? -10 : -50;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Resultado Adverso",
        peso: p,
        motivo: "Improcedência ou Sucumbência"
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
    pontos: [],
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

    // NUMOPEDE / predatória na carteira do advogado — penaliza ranking
    if ((c as any).sinal_numopede || (c as any).sinal_predatoria) {
      const p = -40;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "NUMOPEDE",
        peso: p,
        motivo: "Menção NUMOPEDE / litigância predatória no processo"
      });
    }

    // --- GANHOS OPERACIONAIS ---
    if (c.ultimoRetorno === todayStr) {
      const p = 25;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Atendimento Ativo",
        peso: p,
        motivo: "Atendimento registrado no dia de hoje"
      });
    }
    
    if (isCasoEncerrado(c)) {
      const p = 40;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Resolutividade",
        peso: p,
        motivo: "Baixa / Encerramento do Processo"
      });
    }

    if (c.status === 'No Prazo') {
      const p = 10;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Manutenção",
        peso: p,
        motivo: "Acompanhamento em dia"
      });
    }

    // --- PENALIDADES OPERACIONAIS ---
    if ((c.status === 'Vencido' || c.status === 'Caso Crítico') && !isClientFault) {
      const p = -80;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Retorno Vencido",
        peso: p,
        motivo: "Atraso crítico no contato operacional"
      });
    } else if (c.status === 'Sem Prazo' && !isCasoEncerrado(c)) {
      const p = -40;
      totalPoints += p;
      result.pontos.push({
        protocolo: c.protocolo,
        cliente: c.cliente,
        tipo: "Inércia de Cadastro",
        peso: p,
        motivo: "Processo sem data de próximo retorno"
      });
    }
  });

  result.score = totalPoints;
  return result;
}
