/** A reference to an outcome is not a judicial disposition confirming it. */
export type TerminalEvidence = 'extincao' | 'transito' | 'baixa' | 'arquivamento';
const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

export function conditionalTerminalMention(text: string): boolean {
  return /SOB\s+(?:PENA|COMINACAO)[^.;\n]{0,180}(?:EXTIN|CANCELAMENTO\s+DA\s+DISTRIBUICAO|ARQUIVAMENTO)/.test(normalized(text));
}

export function confirmedTerminalEvent(text: string): TerminalEvidence | null {
  const clauses = normalized(text).split(/[\n;.!?]+/).map(x => x.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (/SOB\s+PENA|SOB\s+COMINACAO|CASO\s+NAO|SE\s+NAO|NAO\s+HAVENDO|PODERA|PODER[AÃ]O|PEDIDO\s+DE|REQUER\w*\s+(?:A\s+)?EXTIN|RECURSO\s+CONTRA|SENTENCA\s+(?:ANULADA|CASSADA)|NAO\s+(?:EXTINGO|DECLARO|DECRETO)|AFASTO\s+(?:A\s+)?EXTIN/.test(clause)) continue;
    if (/^(?:CERTIDAO\s+DE\s+)?TRANSITO EM JULGADO$/.test(clause) ||
        /(?:CERTIFICO|CERTIFICAD[OA]|CERTIFICA-SE|OCORREU)[\s\S]{0,90}TRANSITO EM JULGADO|\bTRANSITOU\s+EM\s+JULGADO/.test(clause)) return 'transito';
    if (/^(?:BAIXA DEFINITIVA|PROCESSO BAIXADO|BAIXA DEFINITIVA DO (?:PROCESSO|FEITO))$/.test(clause) ||
        /(?:EFETUADA|REALIZADA|CERTIFICADA)[\s\S]{0,50}BAIXA DEFINITIVA/.test(clause)) return 'baixa';
    if (/^(?:ARQUIVAMENTO DEFINITIVO|ARQUIVADO DEFINITIVAMENTE|AUTOS ARQUIVADOS DEFINITIVAMENTE)$/.test(clause)) return 'arquivamento';
    if (/\bEXTINGO\b[\s\S]{0,100}\b(?:PROCESSO|FEITO)\b|\b(?:JULGO|DECLARO|DECRETO)\s+(?:O\s+(?:PROCESSO|FEITO)\s+)?EXTINT[OA]\b|\b(?:DETERMINO|DECLARO)\s+(?:O\s+)?CANCELAMENTO\s+DA\s+DISTRIBUICAO\b/.test(clause) ||
        /^(?:EXTINCAO DO PROCESSO|PROCESSO EXTINTO|EXTINTO O PROCESSO|CANCELADA A DISTRIBUICAO|DISTRIBUICAO CANCELADA|SENTENCA DE EXTINCAO)$/.test(clause)) return 'extincao';
  }
  return null;
}
