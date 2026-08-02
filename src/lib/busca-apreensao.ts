/**
 * @fileOverview Motor Heurístico de Detecção de Busca e Apreensão v2.1
 * Prioriza CLASSE PROCESSUAL e contexto real. Evita alarmismo por citação de jurisprudência.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */

export type BAConfidence = 'alta' | 'media' | 'baixa' | null;

export interface BAResult {
  indicio: boolean;
  confianca: BAConfidence;
  motivo: string | null;
}

const CLASSES_BA = [
  'BUSCA E APREENSÃO',
  'BUSCA E APREENSAO',
  'AÇÃO DE BUSCA E APREENSÃO',
  'ACAO DE BUSCA E APREENSAO',
  'PROCEDIMENTO DE BUSCA E APREENSÃO',
  'PROCEDIMENTO DE BUSCA E APREENSAO',
];

const CLASSES_REVISIONAL = [
  'PROCEDIMENTO COMUM',
  'PROCEDIMENTO COMUM CÍVEL',
  'PROCEDIMENTO COMUM CIVEL',
  'AÇÃO REVISIONAL',
  'ACAO REVISIONAL',
  'REVISIONAL DE CONTRATO',
  'OBRIGAÇÃO DE FAZER',
  'OBRIGACAO DE FAZER',
  'PROCEDIMENTO DO JUIZADO ESPECIAL',
  'PROCEDIMENTO SUMÁRIO',
  'PROCEDIMENTO SUMARIO',
];

/**
 * Analisa telemetria DataJud e decide se há indício REAL de Busca e Apreensão.
 * Regra de ouro: classe processual manda; menção isolada em texto (jurisprudência) NÃO gera alerta.
 */
export function analisarBuscaApreensao(data: any): BAResult {
  if (!data) {
    return { indicio: false, confianca: null, motivo: null };
  }

  const movimentos = Array.isArray(data.movimentos) ? data.movimentos : [];
  const relacionados = Array.isArray(data.relacionados) ? data.relacionados : [];
  const classe = String(
    data.classe || data.classeProcessual || data.nomeClasse || data.classe_processual || ''
  ).toUpperCase();

  const isClasseBA = CLASSES_BA.some((c) => classe.includes(c));
  const isClasseRevisional = CLASSES_REVISIONAL.some((c) => classe.includes(c));

  // 1) Classe BA explícita = confiança ALTA
  if (isClasseBA) {
    return {
      indicio: true,
      confianca: 'alta',
      motivo: `Classe processual confirma Busca e Apreensão: ${classe.substring(0, 90)}`,
    };
  }

  const textMovs = movimentos
    .map((m: any) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase())
    .join(' | ');

  const textRel = relacionados
    .map((r: any) => `${r.numero || ''} ${r.classe || ''} ${r.assunto || ''}`.toUpperCase())
    .join(' | ');

  const fullContext = `${classe} ${textMovs} ${textRel}`;

  // 2) Classe revisional/comum: só marca BA se houver MANDADO real de apreensão de veículo
  if (isClasseRevisional) {
    const mandadoReal =
      /\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENS[AÃ]O\b.*\b(VE[IÍ]CULO|BEM|AUTOM[OÓ]VEL)\b|\bAPREENS[AÃ]O\s+DO\s+VE[IÍ]CULO\b|\bDEFERIDA\s+A\s+LIMINAR\s+DE\s+BUSCA\b/.test(
        textMovs
      );
    if (mandadoReal) {
      return {
        indicio: true,
        confianca: 'media',
        motivo:
          'Classe revisional/comum, porém há mandado/liminar explícito de apreensão de veículo nos movimentos.',
      };
    }
    // Jurisprudência citada com "busca e apreensão" NÃO é indício
    return { indicio: false, confianca: null, motivo: null };
  }

  // 3) Sem classe clara: exige termo forte + contexto possessório
  const regexAlta =
    /\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENS[AÃ]O\b|\bAPREENS[AÃ]O\s+DO\s+VE[IÍ]CULO\b|\bDEFERIDA\s+A\s+LIMINAR\s+DE\s+BUSCA\b/;
  if (regexAlta.test(fullContext)) {
    return {
      indicio: true,
      confianca: 'alta',
      motivo: 'Movimentação explícita de mandado/liminar de Busca e Apreensão.',
    };
  }

  const hasAlienacao = /ALIENA[ÇC][AÃ]O\s+FIDUCI[AÁ]RIA/.test(fullContext);
  const hasPosse =
    /REINTEGRA[ÇC][AÃ]O\s+DE\s+POSSE|DEP[OÓ]SITO\s+DO\s+BEM|LIMINAR\s+DEFERIDA.*APREENS/.test(
      fullContext
    );

  if (hasAlienacao && hasPosse) {
    return {
      indicio: true,
      confianca: 'media',
      motivo: 'Alienação fiduciária + medida possessória detectada nos autos.',
    };
  }

  // Menção isolada (ex.: jurisprudência) → NÃO gera alerta
  return { indicio: false, confianca: null, motivo: null };
}
