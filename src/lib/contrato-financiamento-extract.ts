/**
 * Extração heurística de campos de contrato de financiamento (texto OCR/pdf).
 * Não calcula liquidação — só isola variáveis para revisão humana.
 */

export type CamposContratoFinanciamento = {
  valorFinanciado: string | null;
  taxaJuros: string | null;
  cet: string | null;
  prazoMeses: string | null;
  hits: string[];
  confianca: number;
};

function pick(re: RegExp, text: string): string | null {
  const m = text.match(re);
  return m ? String(m[1] || m[0]).trim().slice(0, 40) : null;
}

export function extrairCamposContrato(text: string): CamposContratoFinanciamento {
  const t = String(text || '').replace(/\s+/g, ' ');
  const hits: string[] = [];

  const valorFinanciado =
    pick(/(?:valor\s+(?:do\s+)?(?:financiamento|cr[eé]dito|principal)|cr[eé]dito\s+concedido)\s*[:=]?\s*(R\$\s*[\d.]+,\d{2})/i, t) ||
    pick(/(R\$\s*[\d.]+,\d{2}).{0,40}(?:financiad|liberad|principal)/i, t);

  const taxaJuros =
    pick(/(?:taxa\s+(?:de\s+)?juros|juros\s+remunerat[oó]rios)\s*[:=]?\s*([\d.,]+\s*%\s*(?:a\.?m\.?|a\.?a\.?)?)/i, t) ||
    pick(/([\d.,]+\s*%\s*a\.?\s*m\.?)/i, t);

  const cet =
    pick(/(?:C\.?E\.?T\.?|custo\s+efetivo\s+total)\s*[:=]?\s*([\d.,]+\s*%\s*(?:a\.?a\.?)?)/i, t);

  const prazoMeses =
    pick(/(?:prazo|parcelas?)\s*[:=]?\s*(\d{1,3})\s*(?:meses|parcelas)/i, t) ||
    pick(/(\d{1,3})\s*parcelas/i, t);

  if (valorFinanciado) hits.push(`valor:${valorFinanciado}`);
  if (taxaJuros) hits.push(`taxa:${taxaJuros}`);
  if (cet) hits.push(`cet:${cet}`);
  if (prazoMeses) hits.push(`prazo:${prazoMeses}`);

  let confianca = 20;
  if (valorFinanciado) confianca += 25;
  if (taxaJuros) confianca += 20;
  if (cet) confianca += 15;
  if (prazoMeses) confianca += 15;
  confianca = Math.min(100, confianca);

  return {
    valorFinanciado,
    taxaJuros,
    cet,
    prazoMeses,
    hits,
    confianca,
  };
}

export function contratoTemCamposMinimos(c: CamposContratoFinanciamento): boolean {
  return !!(c.valorFinanciado || (c.taxaJuros && c.prazoMeses));
}
