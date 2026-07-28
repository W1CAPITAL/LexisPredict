/**
 * @fileOverview Motor de Análise Qualitativa de Encerramento v111.0
 * Realiza o diagnóstico heurístico da fase processual para estimar a proximidade do fim do litígio.
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
  const text = `${c.situacao || ''} ${c.status || ''} ${c.observacao || ''} ${c.statusManual || ''}`.toUpperCase();
  const factors: { label: string; positive: boolean }[] = [];
  
  let score = 0;

  // 1. Verificação de Encerramento Direto
  if (/(ENCERRADO|ARQUIVADO|EXTINTO|BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO|CANCELADO)/.test(text)) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'Este processo já consta como finalizado ou baixado nos registros do gabinete.',
      factors: [{ label: 'Baixa definitiva confirmada', positive: true }, { label: 'Processo encerrado', positive: true }]
    };
  }

  // 2. Fatores Processuais Positivos (Existentes)
  if (text.includes('CUMPRIMENTO DE SENTENÇA')) {
    score += 30;
    factors.push({ label: 'Fase de cumprimento de sentença', positive: true });
  }
  if (text.includes('SENTENÇA') || text.includes('SENTENCA')) {
    score += 20;
    factors.push({ label: 'Sentença prolatada', positive: true });
  }
  if (text.includes('ACORDO')) {
    score += 40;
    factors.push({ label: 'Indícios de acordo entre as partes', positive: true });
  }
  if (text.includes('ALVARÁ') || text.includes('ALVARA') || text.includes('LEVANTAMENTO')) {
    score += 25;
    factors.push({ label: 'Fase de expedição de alvará/pagamento', positive: true });
  }
  if (text.includes('TRÂNSITO EM JULGADO') || text.includes('TRANSITO EM JULGADO')) {
    score += 35;
    factors.push({ label: 'Trânsito em julgado identificado', positive: true });
  }

  // 3. Fatores Processuais Positivos (Novos)
  
  // CONCLUSO / fase de decisão
  if (/(CONCLUSO|CONCLUSOS PARA JULGAMENTO|CONCLUSOS PARA DECISÃO|CONCLUSOS PARA DECISAO|PARA JULGAMENTO)/.test(text)) {
    score += 20;
    factors.push({ label: 'Processo concluso para decisão/julgamento', positive: true });
  }

  // Mérito sem recurso explícito no mesmo texto reforça desfecho
  if (/(IMPROCEDENTE|PROCEDENTE|PARCIALMENTE PROCEDENTE)/.test(text) && !/(RECURSO|APELAÇÃO|APELACAO|AGRAVO)/.test(text)) {
    score += 15;
    factors.push({ label: 'Decisão de mérito sem recurso indicado', positive: true });
  }

  // Cliente sumiu / custas / abandono → risco de extinção (moderado)
  if (/(NÃO PAGOU AS CUSTAS|NAO PAGOU AS CUSTAS|CLIENTE SE NEGOU|SEM RETORNO DO CLIENTE|ABANDONO DE CAUSA|FALTA DE REGULARIZAÇÃO|FALTA DE REGULARIZACAO)/.test(text)) {
    score += 12;
    factors.push({ label: 'Indício de inércia do cliente ou custas pendentes (risco de extinção)', positive: true });
  }

  // 4. Fatores Negativos
  if (text.includes('CONTESTAÇÃO') || text.includes('CONTESTACAO')) {
    score -= 15;
    factors.push({ label: 'Ainda em fase de contestação', positive: false });
  }
  if (text.includes('RECURSO') || text.includes('APELAÇÃO') || text.includes('APELACAO')) {
    score -= 20;
    factors.push({ label: 'Recurso pendente de julgamento', positive: false });
  }
  if (text.includes('AUDIÊNCIA') || text.includes('AUDIENCIA')) {
    score -= 10;
    factors.push({ label: 'Audiência futura agendada', positive: false });
  }
  if (text.includes('DISTRIBUÍDO') || text.includes('DISTRIBUIDO')) {
    score -= 25;
    factors.push({ label: 'Processo em estágio inicial de distribuição', positive: false });
  }

  // 5. Classificação Final
  if (score >= 60) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'O processo apresenta uma tendência iminente de encerramento devido à fase executiva ou trânsito em julgado.',
      factors
    };
  } else if (score >= 30) {
    return {
      level: 'Alta',
      color: 'bg-blue-600',
      explanation: 'Processo em fase avançada, com decisões de mérito já proferidas ou concluso para sentença.',
      factors
    };
  } else if (score >= 0) {
    return {
      level: 'Moderada',
      color: 'bg-amber-400',
      explanation: 'O caso encontra-se em fase intermediária de instrução ou aguardando julgamento de recursos ordinários.',
      factors
    };
  } else if (score >= -20) {
    return {
      level: 'Baixa',
      color: 'bg-orange-500',
      explanation: 'Processo ainda em fase de amadurecimento, com ritos iniciais e defesas sendo apresentadas.',
      factors
    };
  } else {
    return {
      level: 'Muito Baixa',
      color: 'bg-red-600',
      explanation: 'Demanda recém-distribuída ou em fase de citação, com longo percurso processual pela frente.',
      factors
    };
  }
}