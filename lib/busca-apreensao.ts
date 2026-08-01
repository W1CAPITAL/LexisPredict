/**
 * @fileOverview Motor Heurístico de Detecção de Busca e Apreensão v1.0
 * Analisa telemetria DataJud (CNJ) em busca de ritos de apreensão de bens.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

export type BAConfidence = 'alta' | 'media' | 'baixa' | null;

export interface BAResult {
  indicio: boolean;
  confianca: BAConfidence;
  motivo: string | null;
}

export function analisarBuscaApreensao(data: any): BAResult {
  if (!data || !data.movimentos) {
    return { indicio: false, confianca: null, motivo: null };
  }

  const movimentos = Array.isArray(data.movimentos) ? data.movimentos : [];
  const relacionados = Array.isArray(data.relacionados) ? data.relacionados : [];
  const classe = String(data.classe || '').toUpperCase();
  
  // 1. Unificação de texto para busca
  const textMovs = movimentos.map((m: any) => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' | ');

  const textRel = relacionados.map((r: any) => 
    `${r.numero || ''} ${r.classe || ''} ${r.assunto || ''}`.toUpperCase()
  ).join(' | ');

  const fullContext = `${classe} ${textMovs} ${textRel}`;

  // 2. Heurística de Confiança ALTA (Termos Explícitos)
  const regexAlta = /\bBUSCA\s*E?\s*APREENS[AÃ]O\b|\bAPREENS[AÃ]O\s+DO\s+VE[IÍ]CULO\b|\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENS[AÃ]O\b/;
  if (regexAlta.test(fullContext)) {
    return {
      indicio: true,
      confianca: 'alta',
      motivo: "Identificada movimentação explícita de Busca e Apreensão."
    };
  }

  // 3. Heurística de Confiança MÉDIA (Alienação + Posse)
  const hasAlienacao = fullContext.includes('ALIENAÇÃO FIDUCIÁRIA') || fullContext.includes('ALIENACAO FIDUCIARIA');
  const hasPosse = /REINTEGRA[ÇC][AÃ]O\s+DE\s+POSSE|MANDADO|DEP[OÓ]SITO\s+DO\s+BEM|LIMINAR\s+DEFERIDA/.test(fullContext);

  if (hasAlienacao && hasPosse) {
    return {
      indicio: true,
      confianca: 'media',
      motivo: "Rito de Alienação Fiduciária com indícios de medida possessória."
    };
  }

  // 4. Heurística de Confiança BAIXA (Termos isolados)
  if (fullContext.includes('BUSCA E APREENSÃO') || fullContext.includes('APREENSAO')) {
     return {
       indicio: true,
       confianca: 'baixa',
       motivo: "Menção isolada ao termo apreensão nos autos."
     };
  }

  return { indicio: false, confianca: null, motivo: null };
}
