/**
 * Tutela / liminar NÃO encerra processo nem é "baixa tribunal".
 * - Tutela condicionada a depósito judicial = processo ATIVO (aguarda cumprimento da condição)
 * - Indeferimento de tutela/liminar = decisão interlocutória; mérito/carteira seguem
 * - "Baixa da liminar" / cassação de tutela ≠ baixa do processo
 */

const TUTELA_LIMINAR_CTX =
  /\b(TUTELA(\s+DE\s+URG[EÊ]NCIA)?|LIMINAR|ANTECIPA[CÇ][AÃ]O\s+DE\s+TUTELA|MEDIDA\s+LIMINAR|PROVIS[OÓ]RIA\s+DE\s+URG[EÊ]NCIA)\b/i;

const INDEFER_TUTELA =
  /\b(INDEFER\w{0,12}|NEGAD[OA]|N[AÃ]O\s+DEFER\w{0,8}|INDEFERIMENTO)\b.{0,80}\b(TUTELA|LIMINAR|ANTECIPA[CÇ][AÃ]O)\b|\b(TUTELA|LIMINAR)\b.{0,80}\b(INDEFER\w{0,12}|NEGAD[OA]|INDEFERIMENTO)\b/i;

const TUTELA_COM_DEPOSITO =
  /\b(TUTELA|LIMINAR)\b.{0,120}\b(DEP[OÓ]SITO(\s+JUDICIAL)?|CAU[CÇ][AÃ]O|PRESTA[CÇ][AÃ]O\s+DE\s+CAU[CÇ][AÃ]O|CONDICIONAD[OA]\s+AO?\s+DEP[OÓ]SITO)\b|\b(DEP[OÓ]SITO(\s+JUDICIAL)?|CAU[CÇ][AÃ]O)\b.{0,120}\b(TUTELA|LIMINAR)\b/i;

const BAIXA_DA_LIMINAR_ONLY =
  /\bBAIXA\s+(DA\s+)?(LIMINAR|TUTELA)\b|\b(CASSAD[OA]|REVOGAD[OA]|SUSPENS[OA])\s+(A\s+)?(LIMINAR|TUTELA)\b/i;

/** Texto fala de tutela/liminar (deferida, indeferida ou condicionada) — NÃO é fim do processo. */
export function isTutelaLiminarNaoEncerramento(text: string): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (INDEFER_TUTELA.test(t)) return true;
  if (TUTELA_COM_DEPOSITO.test(t)) return true;
  if (BAIXA_DA_LIMINAR_ONLY.test(t)) return true;
  // "indeferida a liminar" variants already covered; pure "tutela deferida sob depósito"
  if (TUTELA_LIMINAR_CTX.test(t) && /DEP[OÓ]SITO|CAU[CÇ][AÃ]O|CONDICION/i.test(t)) return true;
  return false;
}

/** Há sinal FORTE de baixa/arquivamento do PROCESSO (não da liminar). */
export function isBaixaProcessoForte(text: string): boolean {
  const t = String(text || "").toUpperCase();
  if (!t) return false;
  if (isTutelaLiminarNaoEncerramento(t)) return false;
  return (
    /BAIXA\s+DEFINITIVA/.test(t) ||
    /BAIXA\s+DO\s+PROCESSO/.test(t) ||
    /PROCESSO\s+BAIXADO/.test(t) ||
    /DETERMINADA\s+A\s+BAIXA(\s+DEFINITIVA)?(\s+DO\s+(FEITO|PROCESSO))?/.test(t) ||
    /ARQUIVAMENTO\s+DEFINITIVO/.test(t) ||
    /ARQUIVADO\s+DEFINITIVAMENTE/.test(t) ||
    /TR[AÂ]NSITO\s+EM\s+JULGADO/.test(t) ||
    /EXTIN[CÇ][AÃ]O\s+DO\s+PROCESSO|PROCESSO\s+EXTINTO|JULGO\s+EXTINTO/.test(t) ||
    /CANCELAMENTO\s+DA\s+DISTRIBUI[CÇ][AÃ]O|CANCELADA\s+A\s+DISTRIBUI/.test(t)
  );
}
