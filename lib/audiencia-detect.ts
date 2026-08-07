/**
 * Detecção ESTRITA de audiência — evita falso positivo por mera menção.
 *
 * NÃO basta a palavra "audiência".
 * Só marca se houver indício de designação / realização futura (ou em curso).
 */

/** Negativos: menção histórica, cancelada, apenas referência */
const RE_NEGATIVO =
  /AUDI[EÊ]NCIA\s+(N[AÃ]O\s+REALIZADA|CANCELADA|DISPENSADA|PREJUDICADA|DESMARCADA)|SEM\s+NECESSIDADE\s+DE\s+AUDI[EÊ]NCIA|DISPENSADA\s+A\s+AUDI[EÊ]NCIA|REFERENTE\s+[AÀ]\s+AUDI[EÊ]NCIA|AP[OÓ]S\s+A\s+AUDI[EÊ]NCIA|NA\s+AUDI[EÊ]NCIA\s+REALIZADA|AUDI[EÊ]NCIA\s+J[AÁ]\s+REALIZADA|EM\s+AUDI[EÊ]NCIA\s+ANTERIOR|REALIZOU-?SE\s+AUDI[EÊ]NCIA|FOI\s+REALIZADA\s+AUDI[EÊ]NCIA/i;

/** Positivos: designação / intimação para comparecer / data marcada */
const RE_DESIGNADA =
  /(?:FICA\s+)?DESIGNADA?\s+(?:A\s+)?AUDI[EÊ]NCIA|AUDI[EÊ]NCIA\s+(?:DE\s+)?(?:CONCILIA[CÇ][AÃ]O|MEDIA[CÇ][AÃ]O|INSTRU[CÇ][AÃ]O|JULGAMENTO)?\s*(?:DESIGNADA|MARCADA|AGENDADA)|INTIMA[CÇ][AÃ]O\s+PARA\s+(?:A\s+)?AUDI[EÊ]NCIA|COMPARECER\s+[AÀ]\s+AUDI[EÊ]NCIA|REALIZAR-?SE-[AÁ]\s+AUDI[EÊ]NCIA|AUDI[EÊ]NCIA\s+PARA\s+O\s+DIA|AUDI[EÊ]NCIA\s+NO\s+DIA|PAUTA\s+DE\s+AUDI[EÊ]NCIA|SESS[AÃ]O\s+DE\s+JULGAMENTO\s+DESIGNAD|CONCILIA[CÇ][AÃ]O\s+DESIGNADA|MEDIA[CÇ][AÃ]O\s+DESIGNADA/i;

/** Data típica junto de audiência (dd/mm/aaaa ou dd de mês) */
const RE_DATA_PROXIMA =
  /AUDI[EÊ]NCIA.{0,80}\d{1,2}\/\d{1,2}\/\d{2,4}|AUDI[EÊ]NCIA.{0,80}\d{1,2}\s+DE\s+\w+\s+DE\s+\d{4}/i;

export type AudienciaDetect = {
  isAudienciaPendente: boolean;
  tipo:
    | 'audiencia_conciliacao'
    | 'audiencia_instrucao'
    | 'audiencia_julgamento'
    | null;
  resumo: string | null;
  motivo: string;
};

/**
 * Retorna true só se a audiência parece designada/a realizar — não mero cite.
 */
export function detectarAudienciaPendente(
  text: string | null | undefined
): AudienciaDetect {
  const t = (text || '').trim();
  if (!t) {
    return {
      isAudienciaPendente: false,
      tipo: null,
      resumo: null,
      motivo: 'texto vazio',
    };
  }

  if (RE_NEGATIVO.test(t)) {
    return {
      isAudienciaPendente: false,
      tipo: null,
      resumo: null,
      motivo: 'menção negativa/histórica/cancelada',
    };
  }

  const designada = RE_DESIGNADA.test(t);
  const comData = RE_DATA_PROXIMA.test(t);
  // Exige designação explícita OU (palavra audiência + padrão de data marcada)
  // NÃO aceita só a palavra AUDIÊNCIA isolada.
  if (!designada && !comData) {
    return {
      isAudienciaPendente: false,
      tipo: null,
      resumo: null,
      motivo: 'apenas menção sem designação',
    };
  }

  let tipo: AudienciaDetect['tipo'] = 'audiencia_julgamento';
  if (/CONCILIA|MEDIA[CÇ]/i.test(t)) tipo = 'audiencia_conciliacao';
  else if (/INSTRU/i.test(t)) tipo = 'audiencia_instrucao';

  return {
    isAudienciaPendente: true,
    tipo,
    resumo:
      tipo === 'audiencia_conciliacao'
        ? 'Audiência de conciliação/mediação designada'
        : tipo === 'audiencia_instrucao'
          ? 'Audiência de instrução designada'
          : 'Audiência designada',
    motivo: designada ? 'designação explícita' : 'audiência com data',
  };
}

/** Compat: true só se pendente de fato */
export function isAudienciaReal(text: string | null | undefined): boolean {
  return detectarAudienciaPendente(text).isAudienciaPendente;
}
