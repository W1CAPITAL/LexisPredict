
/**
 * @fileOverview Motor de Análise Qualitativa de Encerramento v120.0 (DataJud Edition)
 * Realiza o diagnóstico heurístico da fase processual integrando dados oficiais.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

export type ChanceLevel = 'Muito Baixa' | 'Baixa' | 'Moderada' | 'Alta' | 'Muito Alta';

export interface ChanceAnalysis {
  level: ChanceLevel;
  color: string;
  explanation: string;
  factors: { label: string; positive: boolean }[];
}

export function analisarChanceEncerramento(c: any, lawyerPerformanceRate?: number): ChanceAnalysis {
  const factors: { label: string; positive: boolean }[] = [];
  
  // 1. VERIFICAÇÃO SOBERANA DE TELEMETRIA (DataJud)
  if (c.datajud_encerrado_tribunal === true) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'A auditoria oficial do tribunal (DataJud) confirmou a baixa definitiva ou trânsito em julgado deste processo.',
      factors: [
        { label: 'Baixa confirmada via DataJud', positive: true },
        { label: 'Processo finalizado no tribunal', positive: true }
      ]
    };
  }

  // 2. EXTRAÇÃO UNIFICADA (Interno + Externo)
  const text = `
    ${c.situacao || ''} 
    ${c.status || ''} 
    ${c.observacao || ''} 
    ${c.statusManual || ''}
    ${c.datajud_ultimo_nome || ''}
    ${c.djen_ultimo_resumo || ''}
  `.toUpperCase();

  let score = 0;

  // 3. ANÁLISE DE INDÍCIOS EXTERNOS (DJEN / Movimentos)
  if (text.includes('TRÂNSITO EM JULGADO') || text.includes('TRANSITO EM JULGADO')) {
    score += 80;
    factors.push({ label: 'Trânsito em julgado identificado', positive: true });
  }

  if (text.includes('BAIXA DEFINITIVA') || text.includes('ARQUIVAMENTO DEFINITIVO')) {
    score += 80;
    factors.push({ label: 'Rito de baixa definitiva identificado', positive: true });
  }

  // 4. FATORES POSITIVOS (Aproximam o fim)
  if (text.includes('CUMPRIMENTO DE SENTENÇA')) {
    score += 30;
    factors.push({ label: 'Fase de cumprimento de sentença', positive: true });
  }
  if (text.includes('SENTENÇA') || text.includes('SENTENCA')) {
    score += 20;
    factors.push({ label: 'Sentença prolatada', positive: true });
  }
  if (text.includes('ACORDO') || text.includes('HOMOLOGAÇÃO')) {
    score += 40;
    factors.push({ label: 'Acordo ou homologação identificada', positive: true });
  }
  if (/(ALVARÁ|ALVARA|LEVANTAMENTO|PAGAMENTO)/.test(text)) {
    score += 25;
    factors.push({ label: 'Fase de expedição de alvará/pagamento', positive: true });
  }
  if (/(CONCLUSO|JULGAMENTO|SENTENÇA|DECISÃO)/.test(text)) {
    score += 15;
    factors.push({ label: 'Aguardando decisão final do juízo', positive: true });
  }
  if (text.includes('MULTA') || text.includes('CUSTAS PROCESSUAIS')) {
    score += 20;
    factors.push({ label: 'Fase de apuração de multas/custas finais', positive: true });
  }

  // 5. FATORES NEGATIVOS (Atrasam o encerramento)
  if (text.includes('CONTESTAÇÃO') || text.includes('CONTESTACAO')) {
    score -= 15;
    factors.push({ label: 'Ainda em fase de defesa/contestação', positive: false });
  }
  if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('APELACAO')) {
    score -= 20;
    factors.push({ label: 'Recurso pendente de julgamento (atraso)', positive: false });
  }
  if (text.includes('DISTRIBUÍDO') || text.includes('DISTRIBUIDO')) {
    score -= 25;
    factors.push({ label: 'Estágio inicial de distribuição', positive: false });
  }

  // 6. CLASSIFICAÇÃO FINAL
  if (score >= 60) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'O processo apresenta uma tendência iminente de encerramento devido à fase executiva ou composição identificada no tribunal.',
      factors
    };
  } else if (score >= 30) {
    return {
      level: 'Alta',
      color: 'bg-blue-600',
      explanation: 'Processo em fase avançada de mérito ou liquidação final.',
      factors
    };
  } else if (score >= 0) {
    return {
      level: 'Moderada',
      color: 'bg-amber-400',
      explanation: 'O caso encontra-se em instrução ou aguardando julgamento de recursos ordinários.',
      factors
    };
  } else if (score >= -20) {
    return {
      level: 'Baixa',
      color: 'bg-orange-500',
      explanation: 'Processo ainda em fase de amadurecimento e ritos iniciais.',
      factors
    };
  } else {
    return {
      level: 'Muito Baixa',
      color: 'bg-red-600',
      explanation: 'Demanda recém-distribuída ou em fase de citação inicial.',
      factors
    };
  }
}
