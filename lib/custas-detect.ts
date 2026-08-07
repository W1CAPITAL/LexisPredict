/**
 * Detecção de custas / preparo / taxas a partir de movimentos DataJud e texto DJEN.
 * Não consulta portal de pagamento do TJ (APIs públicas geralmente não expõem boleto).
 * Exporta sinal + trechos para o gabinete agir.
 */

export type CustasIndicio = {
  indicio: boolean;
  confianca: 'alta' | 'media' | 'baixa' | null;
  motivo: string | null;
  trechos: string[];
  valoresMencionados: string[];
};

const RE_ALTA =
  /CUSTAS?\s+(INICIAIS|FINAIS|PROCESSUAIS)|RECOLHIMENTO\s+DE\s+CUSTAS|GUIA\s+DE\s+CUSTAS|GUIA\s+GERADA|JUNTADA\s*-?\s*GUIA|EVENTO.{0,40}GUIA\s+GERADA|PREPARO\s+RECURSAL|TAXA\s+JUDICI[AÁ]RIA|COMPLEMENTO\s+DE\s+CUSTAS|INTIMA[CÇ][AÃ]O\s+PARA\s+RECOLHER/i;

const RE_MEDIA =
  /CUSTAS|PREPARO|GRATUIDADE\s+INDEFERIDA|JUSTI[CÇ]A\s+GRATUITA\s+INDEFERIDA|SEM\s+RECOLHIMENTO|FALTA\s+DE\s+RECOLHIMENTO|PAGAMENTO\s+DAS\s+CUSTAS/i;

const RE_VALOR = /R\$\s*[\d.]+,\d{2}|R\$\s*[\d.]+|\d{1,3}(?:\.\d{3})*,\d{2}/g;

export function analisarCustas(input: {
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string }>;
  textos?: string[];
  observacao?: string | null;
}): CustasIndicio {
  const parts: string[] = [];
  for (const m of input.movimentos || []) {
    parts.push(`${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`);
  }
  for (const t of input.textos || []) parts.push(String(t || ''));
  if (input.observacao) parts.push(String(input.observacao));

  const blob = parts.join(' || ');
  const upper = blob.toUpperCase();
  const trechos: string[] = [];
  const valores = new Set<string>();

  for (const p of parts) {
    if (RE_ALTA.test(p) || RE_MEDIA.test(p)) {
      const clean = p.replace(/\s+/g, ' ').trim().slice(0, 220);
      if (clean && trechos.length < 8) trechos.push(clean);
    }
    const found = p.match(RE_VALOR);
    if (found) found.forEach((v) => valores.add(v));
  }

  if (RE_ALTA.test(blob)) {
    return {
      indicio: true,
      confianca: 'alta',
      motivo: 'Menção explícita a custas, preparo ou taxa judiciária.',
      trechos,
      valoresMencionados: [...valores],
    };
  }
  if (RE_MEDIA.test(upper) || RE_MEDIA.test(blob)) {
    return {
      indicio: true,
      confianca: 'media',
      motivo: 'Indício de pendência de custas ou indeferimento de gratuidade.',
      trechos,
      valoresMencionados: [...valores],
    };
  }
  return {
    indicio: false,
    confianca: null,
    motivo: null,
    trechos: [],
    valoresMencionados: [],
  };
}

/** Linha pronta para planilha / dossiê */
export function custasToExportRow(c: CustasIndicio): {
  custas_indicio: string;
  custas_confianca: string;
  custas_motivo: string;
  custas_valores: string;
  custas_trechos: string;
} {
  return {
    custas_indicio: c.indicio ? 'SIM' : 'NAO',
    custas_confianca: c.confianca || '',
    custas_motivo: c.motivo || '',
    custas_valores: c.valoresMencionados.join(' | '),
    custas_trechos: c.trechos.join(' || '),
  };
}
