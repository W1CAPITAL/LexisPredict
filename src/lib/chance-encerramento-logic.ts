
/**
 * @fileOverview Motor de Análise Qualitativa de Encerramento v115.0
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
  // Extração unificada de texto (observação do Veredito ou do repositório)
  const text = `${c.situacao || ''} ${c.status || ''} ${c.observacao || ''} ${c.statusManual || ''}`.toUpperCase();
  const factors: { label: string; positive: boolean }[] = [];
  
  let score = 0;

  // 1. Verificação de Encerramento Direto (Alta Precedência)
  if (/(ENCERRADO|ARQUIVADO|EXTINTO|BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO|CANCELADO|DEFINITIVO|TRÂNSITO EM JULGADO|TRANSITO EM JULGADO)/.test(text)) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'O processo já atingiu o trânsito em julgado ou baixa definitiva, estando tecnicamente finalizado.',
      factors: [{ label: 'Baixa definitiva ou trânsito confirmado', positive: true }, { label: 'Processo encerrado', positive: true }]
    };
  }

  // 2. Fatores Processuais Positivos
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

  // --- NOVOS FATORES OPERACIONAIS (v72.0) ---
  if (text.includes('MULTA') || text.includes('CUSTAS PROCESSUAIS')) {
    score += 20;
    factors.push({ label: 'Fase de apuração de multas/custas finais', positive: true });
  }
  if (text.includes('TRATADO P/GILMAR') || text.includes('GILMAR')) {
    score += 40;
    factors.push({ label: 'Protocolo de encerramento Gilmar ativo', positive: true });
  }
  // ------------------------------------------

  // 3. Fatores Negativos (Atrasam o encerramento)
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

  // 4. Classificação Final
  if (score >= 60) {
    return {
      level: 'Muito Alta',
      color: 'bg-emerald-600',
      explanation: 'O processo apresenta uma tendência iminente de encerramento devido à fase executiva ou composição.',
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
