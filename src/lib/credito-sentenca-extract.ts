/**
 * Motor de extrato de crédito da sentença (Lote 6 + 7).
 * Heurísticas sobre teor DataJud/DJEN — NÃO inventa valor.
 */
import {
  analisarHonorariosAReceber,
  type HonorariosReceberResult,
} from "@/lib/honorarios-receber";

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
  confiancaExtrato: number;
  motivos: string[];
  blobChars: number;
  /** Lote7 */
  honorariosAReceber: boolean;
  honorariosNivel: HonorariosReceberResult["nivel"];
  honorariosConfianca: number;
  honorariosTrechos: string[];
};

function limpar(t: string): string {
  return String(t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RE_VALOR =
  /R\$\s*([\d.]+,\d{2})|R\$\s*([\d.]+)|valor\s+(?:de\s+)?R\$\s*([\d.]+,\d{2})/gi;

export function extrairCreditoSentenca(
  blob: string | null | undefined,
  opts?: { isProcedente?: boolean; meritoTipo?: string | null }
): CreditoSentencaExtrato {
  const text = limpar(blob || "");
  const motivos: string[] = [];
  const valores = new Set<string>();

  let m: RegExpExecArray | null;
  const reV = new RegExp(RE_VALOR.source, "gi");
  while ((m = reV.exec(text)) !== null) {
    const raw = (m[1] || m[2] || m[3] || "").trim();
    if (raw && raw.length >= 3) valores.add(raw);
  }

  const hon = analisarHonorariosAReceber(text, opts);

  const art523 =
    /art\.?\s*523|pagamento\s+volunt[aá]rio|15\s+dias\s+para\s+pagamento|quinzena\s+legal/i.test(
      text
    );
  const multa10 = /multa\s+de\s+10\s*%|10\s*%\s+de\s+multa/i.test(text);
  const pagamentoVoluntario =
    /pagamento\s+volunt[aá]rio|deposito\s+do\s+d[eé]bito/i.test(text);
  const encontroContas =
    /encontro\s+de\s+contas|compensa[cç][aã]o\s+de\s+cr[eé]ditos|compensa[cç][aã]o\s+do\s+d[eé]bito/i.test(
      text
    );
  const sucumbenciaReciproca =
    hon.nivel === "bloqueado" ||
    /sucumb[eê]ncia\s+rec[ií]proca|reciprocamente\s+os\s+honor|honor[aá]rios.{0,25}a\s+cargo\s+d[oa]\s+autor/i.test(
      text
    );
  const sucumbenciaReu =
    hon.temHonorariosAReceber &&
    (hon.nivel === "forte" || hon.nivel === "medio") &&
    !sucumbenciaReciproca;
  const quantiaCliente =
    /condeno\s+.{0,50}pagar|obriga[cç][aã]o\s+de\s+pagar|restitui[cç][aã]o|devolu[cç][aã]o|repeti[cç][aã]o\s+de\s+ind[eé]bito|indeniza[cç][aã]o/i.test(
      text
    ) || valores.size > 0;

  if (valores.size) motivos.push(`${valores.size} valor(es) R$ no teor`);
  if (hon.percentual != null) motivos.push(`honorários ~${hon.percentual}%`);
  if (art523) motivos.push("art. 523 / pagamento voluntário citado");
  if (multa10) motivos.push("multa 10% citada");
  if (sucumbenciaReu) motivos.push("sucumbência a cargo do réu / honorários a receber");
  if (sucumbenciaReciproca) motivos.push("sucumbência recíproca ou a cargo do autor — bloqueio");
  if (encontroContas) motivos.push("encontro de contas — risco");
  if (quantiaCliente) motivos.push("sinal de quantia ao cliente");
  motivos.push(...hon.motivos.slice(0, 4));

  let confianca = 20;
  if (text.length > 400) confianca += 15;
  if (text.length > 1200) confianca += 15;
  if (valores.size) confianca += 15;
  confianca = Math.max(confianca, Math.round(hon.confianca * 0.85));
  if (sucumbenciaReciproca) confianca = Math.min(confianca, 40);
  confianca = Math.max(0, Math.min(100, confianca));

  return {
    valoresDetectados: Array.from(valores).slice(0, 8),
    honorariosPercentual: hon.percentual,
    honorariosTexto: hon.trechos[0] || null,
    art523,
    multa10,
    pagamentoVoluntario,
    encontroContas,
    sucumbenciaReciproca,
    sucumbenciaReu,
    quantiaCliente,
    confiancaExtrato: confianca,
    motivos: [...new Set(motivos)].slice(0, 10),
    blobChars: text.length,
    honorariosAReceber: hon.temHonorariosAReceber,
    honorariosNivel: hon.nivel,
    honorariosConfianca: hon.confianca,
    honorariosTrechos: hon.trechos,
  };
}

export function boostOportunidadeComExtrato(
  score: number,
  extrato: CreditoSentencaExtrato
): { score: number; motivosExtra: string[] } {
  let s = score;
  const motivosExtra: string[] = [];
  if (extrato.honorariosAReceber && extrato.honorariosNivel === "forte") {
    s += 14;
    motivosExtra.push("honorários a receber (forte)");
  } else if (extrato.honorariosAReceber && extrato.honorariosNivel === "medio") {
    s += 9;
    motivosExtra.push("honorários a receber (médio)");
  } else if (extrato.sucumbenciaReu) {
    s += 8;
    motivosExtra.push("extrato: sucumbência réu");
  }
  if (extrato.quantiaCliente && extrato.valoresDetectados.length) {
    s += 6;
    motivosExtra.push("extrato: quantia com R$ no teor");
  }
  if (extrato.art523 && extrato.multa10) {
    s += 5;
    motivosExtra.push("extrato: art.523 + multa 10%");
  }
  if (extrato.honorariosNivel === "bloqueado" || extrato.sucumbenciaReciproca) {
    s -= 18;
    motivosExtra.push("honorários bloqueados / recíproca");
  }
  if (extrato.encontroContas) {
    s -= 8;
    motivosExtra.push("extrato: encontro de contas −score");
  }
  if (extrato.honorariosPercentual != null && extrato.honorariosAReceber) {
    s += 4;
    motivosExtra.push(`% honorários ${extrato.honorariosPercentual}`);
  }
  return { score: Math.max(0, Math.min(100, s)), motivosExtra };
}
