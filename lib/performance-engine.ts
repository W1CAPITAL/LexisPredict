
/**
 * @fileOverview MOTOR DE PERFORMANCE E AUDITORIA v1.0 (ELITE)
 * Analisa o cruzamento entre casos e notas para definir culpabilidade e desempenho.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
 */

import { LegalCase, CaseNote } from "./case-logic";

export type FaultType = "advogado" | "operador" | "externo" | "neutro";

export interface CaseInsight {
  caseId: string;
  fault: FaultType;
  gravity: number; // 0-100
  gravityLabel: "CRÍTICO" | "ALTO" | "MÉDIO" | "BAIXO";
  notesCount: number;
  isPositive: boolean;
}

export interface ExecutiveInsight {
  summary: {
    performanceScore: number;
    performanceLabel: string;
    criticalCount: number;
    mainFault: FaultType;
    totalCases: number;
  };
  person: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    notMyFaultCount: number;
  };
  byFault: {
    advogado: string[];
    operador: string[];
    externo: string[];
  };
  critical: string[];
}

const KEYWORDS = {
  advogado: ["peticionou", "prazo perdido", "manifestou", "preclusão", "recurso fora", "erro jurídico", "advogado", "falha técnica", "pje fora", "intimação não vista"],
  operador: ["telefone errado", "não atualizou", "status errado", "dados incompletos", "não ligou", "operador", "esqueci", "falha de cadastro", "atraso no contato"],
  externo: ["cliente não atende", "juízo", "cartório", "banco não", "força maior", "instabilidade", "greve", "sistema fora", "falecimento", "mudança de endereço"],
  positivo: ["resolvido", "protocolado", "acordo", "êxito", "prazo cumprido", "sucesso", "concluído", "deferido", "ganho", "alvará"]
};

export function buildExecutiveInsight(cases: LegalCase[], notes: CaseNote[]): ExecutiveInsight {
  const insights: CaseInsight[] = cases.map(c => {
    // Busca notas relacionadas ao protocolo ou nome do cliente
    const caseNotes = notes.filter(n => 
      (c.protocolo && n.content.includes(c.protocolo)) || 
      (c.cliente && n.content.toUpperCase().includes(c.cliente.toUpperCase())) ||
      (c.cliente && n.title.toUpperCase().includes(c.cliente.toUpperCase()))
    );

    let fault: FaultType = "neutro";
    let gravity = 0;
    let isPositive = false;

    // 1. Analisa Status para Gravidade Base
    if (c.status === "Vencido" || c.status === "Caso Crítico") gravity = 80;
    else if (c.status === "Atenção" || c.status === "É Hoje") gravity = 50;
    else if (c.status === "No Prazo") gravity = 10;

    // 2. Analisa Texto das Notas para Culpabilidade
    const allText = caseNotes.map(n => n.content.toLowerCase() + " " + n.title.toLowerCase()).join(" ");
    
    if (KEYWORDS.positivo.some(k => allText.includes(k))) isPositive = true;
    
    if (KEYWORDS.advogado.some(k => allText.includes(k))) fault = "advogado";
    else if (KEYWORDS.operador.some(k => allText.includes(k))) fault = "operador";
    else if (KEYWORDS.externo.some(k => allText.includes(k))) fault = "externo";

    // 3. Ajuste de Gravidade por Culpa
    if (fault === "advogado" || fault === "operador") gravity += 20;
    if (isPositive) gravity = Math.max(0, gravity - 40);

    const gravityLabel = gravity >= 80 ? "CRÍTICO" : gravity >= 50 ? "ALTO" : gravity >= 30 ? "MÉDIO" : "BAIXO";

    return {
      caseId: c.protocolo,
      fault,
      gravity: Math.min(100, gravity),
      gravityLabel,
      notesCount: caseNotes.length,
      isPositive
    };
  });

  // Cálculo de Nota de Performance (Base 100)
  const operatorFaults = insights.filter(i => i.fault === "operador").length;
  const criticalCases = insights.filter(i => i.gravity >= 80).length;
  const positiveCases = insights.filter(i => i.isPositive).length;

  let score = 100;
  score -= (operatorFaults * 12);
  score -= (criticalCases * 4);
  score += (positiveCases * 8);
  score = Math.max(0, Math.min(100, score));

  let label = "BOM";
  if (score >= 90) label = "EXCELENTE";
  else if (score >= 75) label = "BOM";
  else if (score >= 50) label = "REGULAR";
  else if (score >= 30) label = "RUIM";
  else label = "CRÍTICO";

  // Insights Qualitativos
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (positiveCases > 0) strengths.push(`Resolutividade confirmada em ${positiveCases} processos.`);
  if (score > 85) strengths.push("Manutenção de baixos índices de erro operacional.");

  if (operatorFaults > 0) {
    weaknesses.push(`Identificadas ${operatorFaults} falhas de acompanhamento operacional.`);
    recommendations.push("Recalibrar fluxo de atualizações diárias para evitar preclusões.");
  }
  
  if (criticalCases > 0) {
    weaknesses.push(`Gestão de risco exposta com ${criticalCases} casos críticos.`);
    recommendations.push("Escalonar casos 'Vencidos' imediatamente para a banca jurídica.");
  }

  if (recommendations.length === 0) recommendations.push("Manter o protocolo de excelência atual.");

  // Detecção de Culpabilidade Principal
  const faultsCount = {
    advogado: insights.filter(i => i.fault === "advogado").length,
    operador: insights.filter(i => i.fault === "operador").length,
    externo: insights.filter(i => i.fault === "externo").length,
  };
  
  let mainFault: FaultType = "neutro";
  if (faultsCount.advogado >= faultsCount.operador && faultsCount.advogado >= faultsCount.externo) mainFault = "advogado";
  else if (faultsCount.operador > faultsCount.advogado && faultsCount.operador > faultsCount.externo) mainFault = "operador";
  else if (faultsCount.externo > 0) mainFault = "externo";

  return {
    summary: {
      performanceScore: score,
      performanceLabel: label,
      criticalCount: criticalCases,
      mainFault,
      totalCases: cases.length
    },
    person: {
      strengths,
      weaknesses,
      recommendations,
      notMyFaultCount: insights.filter(i => i.fault === "externo" || i.fault === "advogado").length
    },
    byFault: {
      advogado: insights.filter(i => i.fault === "advogado").map(i => i.caseId),
      operador: insights.filter(i => i.fault === "operador").map(i => i.caseId),
      externo: insights.filter(i => i.fault === "externo").map(i => i.caseId),
    },
    critical: insights.filter(i => i.gravity >= 80).map(i => i.caseId)
  };
}
