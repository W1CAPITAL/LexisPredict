/**
 * PATCH — funções aprimoradas de DJEN (substituir no arquivo djen.ts)
 * Use as funções abaixo no lugar das originais em src/lib/djen.ts
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

/**
 * Keywords curtas para tarefas / notificações / capa (máx. 3 tags).
 * Evita BA falso positivo por citação de jurisprudência.
 */
export function summarizeDjenKeywords(raw: string | null | undefined): string {
  // Importante: no arquivo real, use plainTextFromDjen do próprio djen.ts
  const plain = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'PUBLICAÇÃO DJEN';

  const upper = plain.toUpperCase();
  const tags: string[] = [];

  const push = (t: string) => {
    if (tags.length < 3 && !tags.includes(t)) tags.push(t);
  };

  // BA só se parecer ato do próprio processo (não jurisprudência)
  if (
    /\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENS|\bAPREENS[AÃ]O\s+DO\s+VE[IÍ]CULO\b|\bDEFERIDA\s+.*BUSCA\s+E\s+APREENS/.test(
      upper
    )
  ) {
    push('BA');
  }
  if (/(EXTINÇÃO|EXTINTO|EXTINGU|ART\.?\s*485|CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(upper))
    push('EXTINÇÃO');
  if (/(SENTENÇA|JULGO|PROCEDENTE|IMPROCEDENTE|PARCIALMENTE)/.test(upper)) push('SENTENÇA');
  if (/(TRÂNSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA|ARQUIVAMENTO)/.test(upper))
    push('TRÂNSITO/BAIXA');
  if (/(CUMPRIMENTO\s+DE\s+SENTENÇA|EXECUÇÃO\s+DE\s+SENTENÇA)/.test(upper)) push('CUMPRIMENTO');
  if (/(CUSTAS|TAXAS?\s+JUDICI[AÁ]RIAS|PREPARO)/.test(upper)) push('CUSTAS');
  if (/(AJG|JUSTIÇA\s+GRATUITA|GRATUIDADE|HIPOSSUFICI)/.test(upper)) push('AJG');
  if (/(EMENDA|EMENDE|ADITE|ADITAMENTO)/.test(upper)) push('EMENDA');
  if (/(REDISTRIBUIÇÃO|DECLÍNIO|INCOMPETÊNCIA)/.test(upper)) push('REDISTRIBUIÇÃO');
  if (/(INTIMAÇÃO|INTIMADO|CIÊNCIA)/.test(upper)) push('INTIMAÇÃO');
  if (/(DESPACHO|DETERMINO)/.test(upper)) push('DESPACHO');
  if (/(AUDIÊNCIA)/.test(upper)) push('AUDIÊNCIA');
  if (/(LIMINAR|TUTELA\s+DE\s+URGÊNCIA|ANTECIPAÇÃO\s+DE\s+TUTELA)/.test(upper)) push('LIMINAR');

  return tags.length > 0 ? tags.join(' | ') : 'PUBLICAÇÃO DJEN';
}

/**
 * Classificação de mérito a partir do texto da comunicação.
 * Exige contexto de ato processual real para BA.
 */
export function classifyEventFromText(
  text: string | null | undefined
): { tipo: string; label: string } {
  const upper = String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!upper) return { tipo: 'rotina', label: 'Rotina' };

  if (
    /\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENS|\bAPREENS[AÃ]O\s+DO\s+VE[IÍ]CULO\b|\bDEFERIDA\s+.*BUSCA\s+E\s+APREENS/.test(
      upper
    )
  ) {
    return { tipo: 'ba', label: 'Busca e Apreensão' };
  }
  if (
    /(TRÂNSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA|ARQUIVAMENTO|EXTINÇÃO|EXTINTO|CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(
      upper
    )
  ) {
    return { tipo: 'transito_ou_baixa', label: 'Trânsito / Baixa' };
  }
  if (/(SENTENÇA).*(IMPROCEDENTE)|IMPROCEDENTE/.test(upper)) {
    return { tipo: 'sentenca_improcedente', label: 'Sentença Improcedente' };
  }
  if (/(SENTENÇA).*(PROCEDENTE)|PROCEDENTE/.test(upper) && !/IMPROCEDENTE/.test(upper)) {
    return { tipo: 'sentenca_procedente', label: 'Sentença Procedente' };
  }
  if (/(PARCIALMENTE\s+PROCEDENTE|PROCEDÊNCIA\s+PARCIAL)/.test(upper)) {
    return { tipo: 'sentenca_parcial', label: 'Sentença Parcial' };
  }
  if (/(CUMPRIMENTO\s+DE\s+SENTENÇA|EXECUÇÃO\s+DE\s+SENTENÇA)/.test(upper)) {
    return { tipo: 'cumprimento_sentenca', label: 'Cumprimento de Sentença' };
  }
  if (/(LIMINAR|TUTELA\s+DE\s+URGÊNCIA|ANTECIPAÇÃO\s+DE\s+TUTELA)/.test(upper)) {
    return { tipo: 'liminar', label: 'Liminar / Tutela' };
  }
  if (/(AUDIÊNCIA\s+DE\s+JULGAMENTO)/.test(upper)) {
    return { tipo: 'audiencia_julgamento', label: 'Audiência de Julgamento' };
  }
  if (/(AUDIÊNCIA\s+DE\s+INSTRUÇÃO)/.test(upper)) {
    return { tipo: 'audiencia_instrucao', label: 'Audiência de Instrução' };
  }
  if (/(AUDIÊNCIA\s+DE\s+CONCILIAÇÃO|AUDIÊNCIA\s+DE\s+MEDIAÇÃO)/.test(upper)) {
    return { tipo: 'audiencia_conciliacao', label: 'Audiência de Conciliação' };
  }
  if (/(CANCELAMENTO\s+DA\s+DISTRIBUIÇÃO)/.test(upper)) {
    return { tipo: 'cancelamento_distribuicao', label: 'Cancelamento da Distribuição' };
  }

  return { tipo: 'novo_andamento_relevante', label: 'Publicação DJEN' };
}
