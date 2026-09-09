/**
 * Parser de extrato de distribuição (eproc / Justiça Estadual)
 * Independente da ordem das linhas — identifica por rótulos e padrões.
 * Ex.: PDF "Processo Eletrônico · Número do Processo · Partes · Valor · Órgão · Magistrado"
 */

import { digitsOnly, formatCnj, extractCnjFromText } from "@/lib/cnj-extract";

export type ExtratoDistribuicao = {
  protocolo: string | null;
  chave_consulta: string | null;
  advogado_nome: string | null;
  advogado_oab: string | null;
  advogado_oab_uf: string | null;
  data_envio: string | null;
  hora_envio: string | null;
  evento: string | null;
  autor: string | null;
  reu: string | null;
  partes_raw: string | null;
  valor_causa: number | null;
  valor_causa_fmt: string | null;
  custas: number | null;
  custas_fmt: string | null;
  orgao_julgador: string | null;
  magistrado: string | null;
  tribunal_hint: string | null; // ex. TJAC via 8.01
  fonte: "extrato_pdf" | "texto_livre";
  confianca: number; // 0-100
};

function moneyToNumber(s: string): number | null {
  const raw = String(s || "")
    .replace(/R\$\s?/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pick(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function normalizeSpace(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/** Converte texto OCR/PDF em campos de cadastro — ordem irrelevante. */
export function parseExtratoDistribuicao(textoBruto: string): ExtratoDistribuicao {
  const text = String(textoBruto || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n");
  const oneLine = text.replace(/\n+/g, " ");

  const protocolo =
    extractCnjFromText(text) ||
    pick(oneLine, [
      /N[uú]mero\s+do\s+Processo\s*[:\s]+([0-9.\-]+)/i,
      /Processo\s*[:\s]+(\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4})/i,
    ]);

  const chave = pick(oneLine, [
    /Chave\s+para\s+consulta\s*[:\s]+(\d{6,})/i,
    /Chave\s*[:\s]+(\d{6,})/i,
  ]);

  // Nome do advogado: rótulo "Nome:" que NÃO é "Nome da(s) Parte(s)"
  let advogado_nome = pick(text, [
    /(?:^|\n)\s*Nome\s*:\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{3,80}?)(?:\n|OAB)/i,
    /Advogad[oa]\s*:\s*([^\n]+)/i,
  ]);
  if (advogado_nome && /parte|autor|r[eé]u/i.test(advogado_nome)) advogado_nome = null;

  const oabRaw = pick(oneLine, [
    /OAB\s*\/?\s*Sigla\s*:\s*([A-Z]{2}\s*\d{3,7})/i,
    /OAB\s*[:\/\s]*([A-Z]{2}\s*\d{3,7})/i,
    /OAB\s*\/?\s*([A-Z]{2})\s*(\d{3,7})/i,
  ]);
  let advogado_oab: string | null = null;
  let advogado_oab_uf: string | null = null;
  if (oabRaw) {
    const m = oabRaw.replace(/\s+/g, "").match(/([A-Z]{2})(\d{3,7})/i);
    if (m) {
      advogado_oab_uf = m[1].toUpperCase();
      advogado_oab = m[2];
    } else {
      advogado_oab = oabRaw.trim();
    }
  }

  const data_envio = pick(oneLine, [
    /Data\s+Envio\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
    /Data\s+de\s+Envio\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
  ]);
  const hora_envio = pick(oneLine, [/Hora\s+de\s+Envio\s*:\s*(\d{1,2}:\d{2}(?::\d{2})?)/i]);
  const evento = pick(oneLine, [/Evento\s*:\s*([^\n]+?)(?:\s+Nome\s+da|\s+Valor\s+da|$)/i]);

  // Partes: bloco entre "Nome da(s) Parte(s)" e "Valor da Causa"
  let partes_raw: string | null = null;
  let autor: string | null = null;
  let reu: string | null = null;
  const partesBlock = text.match(
    /Nome\s+da\(s\)\s+Parte\(s\)\s*:?\s*([\s\S]*?)(?:Valor\s+da\s+Causa|Custas\s+Processuais|Org[aã]o\s+Julgador)/i
  );
  if (partesBlock) {
    partes_raw = normalizeSpace(partesBlock[1]);
    const autorM = partes_raw.match(/(.+?)\s*[-–]\s*AUTOR/i);
    const reuM = partes_raw.match(/(.+?)\s*[-–]\s*R[EÉ]U/i);
    if (autorM) autor = normalizeSpace(autorM[1].replace(/\s*X\s*$/i, ""));
    if (reuM) reu = normalizeSpace(reuM[1]);
    // fallback: "A X B"
    if (!autor && !reu && /X/i.test(partes_raw)) {
      const [a, b] = partes_raw.split(/\s+X\s+/i);
      autor = normalizeSpace(a || "");
      reu = normalizeSpace(b || "");
    }
  }

  const valorFmt = pick(oneLine, [
    /Valor\s+da\s+Causa\s*:\s*(R\$\s*[\d.]+,\d{2})/i,
    /Valor\s+da\s+Causa\s*:\s*([\d.]+,\d{2})/i,
  ]);
  const custasFmt = pick(oneLine, [
    /Custas\s+Processuais\s*:\s*(R\$\s*[\d.]+,\d{2})/i,
    /Custas\s+Processuais\s*:\s*([\d.]+,\d{2})/i,
  ]);

  const orgao = pick(oneLine, [
    /Org[aã]o\s+Julgador\s*:\s*(.+?)(?:\s+Magistrado\s*:|$)/i,
  ]);
  const magistrado = pick(oneLine, [
    /Magistrado\s*:\s*(.+?)(?:\s+Assinatura\s*:|\s+Data\s+de\s+Impress|$)/i,
  ]);

  // Tribunal pelo CNJ (segmento 8.XX)
  let tribunal_hint: string | null = null;
  const d = digitsOnly(protocolo || "");
  if (d.length === 20) {
    const j = d.slice(13, 14); // justiça
    const tr = d.slice(14, 16); // tribunal
    if (j === "8") {
      const map: Record<string, string> = {
        "01": "TJAC", "02": "TJAL", "03": "TJAP", "04": "TJAM", "05": "TJBA",
        "06": "TJCE", "07": "TJDF", "08": "TJES", "09": "TJGO", "10": "TJMA",
        "11": "TJMT", "12": "TJMS", "13": "TJMG", "14": "TJPA", "15": "TJPB",
        "16": "TJPR", "17": "TJPE", "18": "TJPI", "19": "TJRJ", "20": "TJRN",
        "21": "TJRS", "22": "TJRO", "23": "TJRR", "24": "TJSC", "25": "TJSP",
        "26": "TJSE", "27": "TJTO",
      };
      tribunal_hint = map[tr] || `TJ-${tr}`;
    }
  }

  let confianca = 0;
  if (protocolo) confianca += 30;
  if (autor || reu) confianca += 20;
  if (valorFmt) confianca += 15;
  if (orgao) confianca += 15;
  if (advogado_nome || advogado_oab) confianca += 10;
  if (magistrado) confianca += 10;

  return {
    protocolo: protocolo ? formatCnj(protocolo) : null,
    chave_consulta: chave,
    advogado_nome: advogado_nome ? normalizeSpace(advogado_nome) : null,
    advogado_oab,
    advogado_oab_uf,
    data_envio,
    hora_envio,
    evento: evento ? normalizeSpace(evento) : null,
    autor,
    reu,
    partes_raw,
    valor_causa: valorFmt ? moneyToNumber(valorFmt) : null,
    valor_causa_fmt: valorFmt,
    custas: custasFmt ? moneyToNumber(custasFmt) : null,
    custas_fmt: custasFmt,
    orgao_julgador: orgao ? normalizeSpace(orgao) : null,
    magistrado: magistrado ? normalizeSpace(magistrado) : null,
    tribunal_hint,
    fonte: /N[uú]mero\s+do\s+Processo/i.test(text) ? "extrato_pdf" : "texto_livre",
    confianca: Math.min(100, confianca),
  };
}

/** Mapeia extrato → campos de processo do Lexis (sem inventar). */
export function extratoParaCamposCase(e: ExtratoDistribuicao) {
  return {
    protocolo_ref: e.protocolo,
    cliente: e.autor || "",
    parte_passiva: e.reu || "",
    advogado: e.advogado_nome
      ? e.advogado_oab_uf && e.advogado_oab
        ? `${e.advogado_nome} · OAB/${e.advogado_oab_uf}${e.advogado_oab}`
        : e.advogado_nome
      : "",
    tribunal: e.tribunal_hint || "",
    orgao_julgador: e.orgao_julgador || "",
    observacoes: [
      e.evento ? `Evento: ${e.evento}` : "",
      e.valor_causa_fmt ? `Valor causa: ${e.valor_causa_fmt}` : "",
      e.custas_fmt ? `Custas: ${e.custas_fmt}` : "",
      e.magistrado ? `Magistrado: ${e.magistrado}` : "",
      e.chave_consulta ? `Chave consulta: ${e.chave_consulta}` : "",
      e.data_envio ? `Distribuição: ${e.data_envio}${e.hora_envio ? " " + e.hora_envio : ""}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    valor_causa: e.valor_causa,
    status_interno: "EM ANDAMENTO",
    status: "No Prazo",
  };
}
