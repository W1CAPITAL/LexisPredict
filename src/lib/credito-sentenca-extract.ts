/**
 * Motor de extrato de crédito da sentença (Lote 6).
 * Heurísticas sobre teor DataJud/DJEN — NÃO inventa valor.
 * Qualquer R$ extraído exige validação humana antes de uso comercial.
 */

export type CreditoSentencaExtrato = {
  valoresDetectados: string[];
  honorariosPercentual: number | null;
  honorariosTexto: string | null;
  art523: boolean;
  multa10: boolean;
  pagamentoVoluntario: boolean;
  encontroContas: boolean;
  sucumbenciaReciproca: boolean;
  sucumbenciaReu: boolean;
  quantiaCliente: boolean;
  confiancaExtrato: number; // 0–100
  motivos: string[];
  /** texto limpo usado (tamanho) */
  blobChars: number;
};

function limpar(t: string): string {
  return String(t || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Captura R$ 1.234,56 / 1234,56 / 1.234.567,89 */
const RE_VALOR =
  /R\$\s*([\d.]+,\d{2})|R\$\s*([\d.]+)|valor\s+(?:de\s+)?R\$\s*([\d.]+,\d{2})/gi;

const RE_HON_PCT =
  /honor[aá]rios(?:\s+advocat[ií]cios)?[^.%]{0,40}?(\d{1,2}(?:[.,]\d+)?)\s*%/gi;

export function extrairCreditoSentenca(blob: string | null | undefined): CreditoSentencaExtrato {
  const text = limpar(blob || '');
  const motivos: string[] = [];
  const valores = new Set<string>();

  let m: RegExpExecArray | null;
  const reV = new RegExp(RE_VALOR.source, 'gi');
  while ((m = reV.exec(text)) !== null) {
    const raw = (m[1] || m[2] || m[3] || '').trim();
    if (raw && raw.length >= 3) valores.add(raw.includes(',') ? raw : raw);
  }

  let honorariosPercentual: number | null = null;
  let honorariosTexto: string | null = null;
  const reH = new RegExp(RE_HON_PCT.source, 'gi');
  while ((m = reH.exec(text)) !== null) {
    const pct = parseFloat(String(m[1]).replace(',', '.'));
    if (!Number.isNaN(pct) && pct > 0 && pct <= 30) {
      honorariosPercentual = pct;
      honorariosTexto = m[0].slice(0, 80);
    }
  }

  const art523 =
    /art\.?\s*523|pagamento\s+volunt[aá]rio|15\s+dias\s+para\s+pagamento|quinzena\s+legal/i.test(
      text
    );
  const multa10 = /multa\s+de\s+10\s*%|10\s*%\s+de\s+multa/i.test(text);
  const pagamentoVoluntario = /pagamento\s+volunt[aá]rio|deposito\s+do\s+d[eé]bito/i.test(text);
  const encontroContas =
    /encontro\s+de\s+contas|compensa[cç][aã]o\s+de\s+cr[eé]ditos|compensa[cç][aã]o\s+do\s+d[eé]bito/i.test(
      text
    );
  const sucumbenciaReciproca =
    /sucumb[eê]ncia\s+rec[ií]proca|reciprocamente\s+os\s+honor|honor[aá]rios.{0,25}a\s+cargo\s+d[oa]\s+autor/i.test(
      text
    );
  const sucumbenciaReu =
    /honor[aá]rios.{0,40}(r[eé]u|banco|institui[cç][aã]o)|a\s+cargo\s+d[oa]\s+r[eé]u|arbitro\s+os\s+honor|fixo\s+os\s+honor|condeno\s+.{0,30}honor[aá]rios/i.test(
      text
    ) && !sucumbenciaReciproca;
  const quantiaCliente =
    /condeno\s+.{0,50}pagar|obriga[cç][aã]o\s+de\s+pagar|restitui[cç][aã]o|devolu[cç][aã]o|repeti[cç][aã]o\s+de\s+ind[eé]bito|indeniza[cç][aã]o/i.test(
      text
    ) || valores.size > 0;

  if (valores.size) motivos.push(`${valores.size} valor(es) R$ no teor`);
  if (honorariosPercentual != null) motivos.push(`honorários ~${honorariosPercentual}%`);
  if (art523) motivos.push('art. 523 / pagamento voluntário citado');
  if (multa10) motivos.push('multa 10% citada');
  if (sucumbenciaReu) motivos.push('sucumbência a cargo do réu');
  if (sucumbenciaReciproca) motivos.push('sucumbência recíproca — risco');
  if (encontroContas) motivos.push('encontro de contas — risco');
  if (quantiaCliente) motivos.push('sinal de quantia ao cliente');

  let confianca = 20;
  if (text.length > 400) confianca += 15;
  if (text.length > 1200) confianca += 15;
  if (valores.size) confianca += 20;
  if (honorariosPercentual != null) confianca += 15;
  if (sucumbenciaReu) confianca += 10;
  if (art523) confianca += 10;
  if (sucumbenciaReciproca || encontroContas) confianca -= 15;
  confianca = Math.max(0, Math.min(100, confianca));

  return {
    valoresDetectados: Array.from(valores).slice(0, 8),
    honorariosPercentual,
    honorariosTexto,
    art523,
    multa10,
    pagamentoVoluntario,
    encontroContas,
    sucumbenciaReciproca,
    sucumbenciaReu,
    quantiaCliente,
    confiancaExtrato: confianca,
    motivos,
    blobChars: text.length,
  };
}

/** Une extrato ao score comercial (não libera R$ sozinho). */
export function boostOportunidadeComExtrato(
  score: number,
  extrato: CreditoSentencaExtrato
): { score: number; motivosExtra: string[] } {
  let s = score;
  const motivosExtra: string[] = [];
  if (extrato.sucumbenciaReu) {
    s += 8;
    motivosExtra.push('extrato: sucumbência réu');
  }
  if (extrato.quantiaCliente && extrato.valoresDetectados.length) {
    s += 6;
    motivosExtra.push('extrato: quantia com R$ no teor');
  }
  if (extrato.art523 && extrato.multa10) {
    s += 5;
    motivosExtra.push('extrato: art.523 + multa 10%');
  }
  if (extrato.sucumbenciaReciproca) {
    s -= 12;
    motivosExtra.push('extrato: recíproca −score');
  }
  if (extrato.encontroContas) {
    s -= 8;
    motivosExtra.push('extrato: encontro de contas −score');
  }
  return { score: Math.max(0, Math.min(100, s)), motivosExtra };
}
