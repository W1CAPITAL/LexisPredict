/**
 * Identificadores ampliados de cumprimento de sentença + probabilidade de encerramento.
 * Usar no audit (DataJud + DJEN) e no dossiê.
 */

export const CUMPRIMENTO_KEYWORDS = [
  'CUMPRIMENTO DE SENTENÇA',
  'CUMPRIMENTO DE SENTENCA',
  'CUMPRIMENTO DEFINITIVO',
  'CUMPRIMENTO PROVISÓRIO',
  'CUMPRIMENTO PROVISORIO',
  'EXECUÇÃO DE SENTENÇA',
  'EXECUCAO DE SENTENCA',
  'EXECUÇÃO DEFINITIVA',
  'FASE DE CUMPRIMENTO',
  'INÍCIO DO CUMPRIMENTO',
  'INICIO DO CUMPRIMENTO',
  'PROCEDIMENTO DE CUMPRIMENTO',
  'REQUERIMENTO DE CUMPRIMENTO',
  'PETIÇÃO DE CUMPRIMENTO',
  'PETICAO DE CUMPRIMENTO',
  'CUMPRIMENTO PROVISÓRIO DE SENTENÇA',
  'HOMOLOGAÇÃO DE CÁLCULOS',
  'HOMOLOGACAO DE CALCULOS',
  'IMPUGNAÇÃO AOS CÁLCULOS',
  'PENHORA',
  'BLOQUEIO JUDICIAL',
  'SISBAJUD',
  'BACENJUD',
  'AVALIAÇÃO DE BEM',
  'EXPROPRIAÇÃO',
  'SATISFAÇÃO DA OBRIGAÇÃO',
  'QUITACAO DO DÉBITO',
  'ALVARÁ DE LEVANTAMENTO',
  'ALVARA DE LEVANTAMENTO',
  'RPV',
  'PRECATÓRIO',
  'PRECATORIO',
];

export const ENCERRAMENTO_KEYWORDS = [
  'TRÂNSITO EM JULGADO',
  'TRANSITO EM JULGADO',
  'BAIXA DEFINITIVA',
  'ARQUIVAMENTO',
  'ARQUIVADO',
  'EXTINÇÃO DO PROCESSO',
  'EXTINCAO DO PROCESSO',
  'EXTINTO O PROCESSO',
  'CANCELAMENTO DA DISTRIBUIÇÃO',
  'CANCELAMENTO DA DISTRIBUICAO',
  'SENTENÇA DE EXTINÇÃO',
  'HOMOLOGAÇÃO DE ACORDO',
  'HOMOLOGACAO DE ACORDO',
  'DESISTÊNCIA',
  'DESISTENCIA',
  'REMESSA AO ARQUIVO',
];

export function detectCumprimentoFromText(text: string): { hit: boolean; motivo: string | null } {
  const u = String(text || '').toUpperCase();
  for (const kw of CUMPRIMENTO_KEYWORDS) {
    if (u.includes(kw)) return { hit: true, motivo: kw };
  }
  return { hit: false, motivo: null };
}

export function detectEncerramentoFromText(text: string): { hit: boolean; motivo: string | null } {
  const u = String(text || '').toUpperCase();
  for (const kw of ENCERRAMENTO_KEYWORDS) {
    if (u.includes(kw)) return { hit: true, motivo: kw };
  }
  return { hit: false, motivo: null };
}

/**
 * Score 0–100 de chance de encerramento / fase executiva.
 * Heurística operacional — não é predicção judicial oficial.
 */
export function scoreProbabilidadeEncerramento(input: {
  datajud_encerrado_tribunal?: boolean;
  em_cumprimento_sentenca?: boolean;
  evento_tipo?: string | null;
  evento_resumo?: string | null;
  datajud_ultimo_nome?: string | null;
  djen_ultimo_resumo?: string | null;
  movimentosText?: string;
}): { score: number; label: string; factors: string[] } {
  let score = 5;
  const factors: string[] = [];

  if (input.datajud_encerrado_tribunal) {
    score += 55;
    factors.push('Baixa/trânsito no tribunal');
  }
  if (input.em_cumprimento_sentenca || input.evento_tipo === 'cumprimento_sentenca') {
    score += 25;
    factors.push('Fase de cumprimento');
  }
  if (input.evento_tipo === 'sentenca_procedente') {
    score += 15;
    factors.push('Sentença procedente');
  }
  if (input.evento_tipo === 'sentenca_improcedente') {
    score += 20;
    factors.push('Sentença improcedente');
  }
  if (String(input.evento_tipo || '').includes('transito') || String(input.evento_tipo || '').includes('baixa')) {
    score += 40;
    factors.push('Evento de trânsito/baixa');
  }

  const blob = [
    input.evento_resumo,
    input.datajud_ultimo_nome,
    input.djen_ultimo_resumo,
    input.movimentosText,
  ]
    .join(' ')
    .toUpperCase();

  const enc = detectEncerramentoFromText(blob);
  if (enc.hit) {
    score += 20;
    factors.push(`Texto: ${enc.motivo}`);
  }
  const cump = detectCumprimentoFromText(blob);
  if (cump.hit) {
    score += 12;
    factors.push(`Cumprimento: ${cump.motivo}`);
  }

  score = Math.min(100, Math.max(0, score));
  let label = 'Baixa';
  if (score >= 75) label = 'Alta';
  else if (score >= 45) label = 'Média';
  else if (score >= 25) label = 'Moderada';

  return { score, label, factors };
}
