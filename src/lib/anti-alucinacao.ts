/**
 * Anti-alucinação jurídica — inspirado em:
 * - pizaniadv/antialucinacao-juridica (duas camadas: interna × externa)
 * - rogeriotravagin/escritorio-ia (constituição: nada inventado, [VERIFICAR], disclaimer OAB)
 *
 * Uso: antes de enviar rascunho IA ao operador / ao cliente.
 */

export type AncoraEstado = "conferida" | "declarada" | "ausente";

export type FatoAudit = {
  texto: string;
  ancora?: string; // ex: "fls. 214", "Num. 4455"
  estado: AncoraEstado;
  vicio?: "orfao" | "inferencia_vestida" | "adverso_omitido" | "ancora_deslocada";
};

export type CitacaoAudit = {
  texto: string;
  tipo: "lei" | "sumula" | "acordao" | "doutrina" | "outro";
  grau: "CONFIRMADO" | "CORROBORADO" | "PROVAVEL" | "INCERTO";
  fontePrimaria?: string;
};

export type AuditResult = {
  ok: boolean;
  fatos: FatoAudit[];
  citacoes: CitacaoAudit[];
  redFlags: string[];
  textoComMarcadores: string;
  disclaimerOab: string;
};

const DISCLAIMER_OAB =
  "⚠️ Revisão obrigatória por advogado(a) inscrito(a) na OAB antes de qualquer protocolo ou envio ao cliente. " +
  "Este texto é apoio operacional e não substitui análise profissional.";

/** Heurística: marca números/datas/valores sem contexto de âncora visível. */
const FATO_RE =
  /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\bR\$\s*[\d.]+(?:,\d{2})?\b|\bfls?\.\s*\d+\b|\bNum\.\s*\d+)/gi;

/** Heurística leve de citação (súmula, art., Resp, etc.). */
const CITACAO_RE =
  /\b(S[uú]mula\s+(?:Vinculante\s+)?n?[ºo°]?\s*\d+|art\.?\s*\d+[ºo°]?|REsp\s*[\d.]+|HC\s*[\d.]+|ADI\s*\d+)\b/gi;

/**
 * Auditoria rápida de texto gerado por IA.
 * Não substitui conferência humana — só força marcadores e red flags.
 */
export function auditarTextoJuridico(
  texto: string,
  opts?: { exigirAncoras?: boolean }
): AuditResult {
  const t = String(texto || "");
  const redFlags: string[] = [];
  const fatos: FatoAudit[] = [];
  const citacoes: CitacaoAudit[] = [];

  // Fatos / âncoras
  const matches = t.match(FATO_RE) || [];
  for (const m of matches) {
    const temAncora = /fls?\.|Num\./i.test(m);
    fatos.push({
      texto: m,
      ancora: temAncora ? m : undefined,
      estado: temAncora ? "declarada" : "ausente",
      vicio: temAncora ? undefined : "orfao",
    });
  }

  if (opts?.exigirAncoras && fatos.some((f) => f.estado === "ausente")) {
    redFlags.push("Há datas/valores sem âncora nos autos (possível fato órfão).");
  }

  // Citações — grau INCERTO até conferência humana/fonte
  const cits = t.match(CITACAO_RE) || [];
  for (const c of cits) {
    citacoes.push({
      texto: c,
      tipo: /s[uú]mula/i.test(c) ? "sumula" : /art/i.test(c) ? "lei" : "acordao",
      grau: "INCERTO",
    });
  }
  if (citacoes.length > 0) {
    redFlags.push(
      `${citacoes.length} citação(ões) marcada(s) como INCERTO — conferir fonte primária antes de usar.`
    );
  }

  // Proibições estilo escritorio-ia
  let marcado = t;
  // Não inventamos — se IA deixou placeholder genérico, reforça
  marcado = marcado.replace(/\[inserir[^\]]*\]/gi, "[preencher: $&]");
  if (citacoes.length > 0) {
    for (const c of citacoes) {
      if (c.grau === "INCERTO") {
        marcado = marcado.replace(c.texto, `[VERIFICAR: ${c.texto}]`);
      }
    }
  }

  const ok = redFlags.length === 0;

  return {
    ok,
    fatos,
    citacoes,
    redFlags,
    textoComMarcadores: marcado.trim(),
    disclaimerOab: DISCLAIMER_OAB,
  };
}

/** Anexa disclaimer OAB se ainda não estiver no texto. */
export function garantirDisclaimerOab(texto: string): string {
  const t = String(texto || "").trim();
  if (/revisão obrigatória por advogado/i.test(t)) return t;
  return `${t}\n\n${DISCLAIMER_OAB}`;
}
