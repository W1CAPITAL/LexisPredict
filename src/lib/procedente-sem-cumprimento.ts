/**
 * Sentença procedente (favorável ao autor) SEM cumprimento de sentença instaurado.
 * Prioridade operacional: em ~5 anos a pretensão executória pode prescrever (art. 206 CC / CPC).
 * Processos ~4 anos parados = janela crítica.
 */

const RE_JULGO_PROCEDENTE_AUTOR =
  /julgo\s+procedente[s]?\s+(em\s+parte\s+)?(o[s]?\s+)?pedido[s]?\s+(do\s+autor|da\s+autora|da\s+parte\s+autora)?/i;

const RE_PROCEDENTE_CLARO =
  /\bjulgo\s+procedente\b|\bjulgo\s+procedentes\b|\bdeclaro\s+procedente\b|\bpedido[s]?\s+(do\s+autor\s+)?procedente[s]?\b|\bsenten[cç]a\s+(parcialmente\s+)?procedente\b/i;

const RE_PARCIAL = /procedente\s+em\s+parte|parcialmente\s+procedente/i;

const RE_IMPROCEDENTE =
  /\bjulgo\s+improcedente\b|\bpedido[s]?\s+improcedente|\bsenten[cç]a\s+improcedente\b/i;

/** Cumprimento já instaurado / em curso no teor. */
const RE_CUMPRIMENTO_INSTAURADO =
  /\b(instaur[oa]\w*\s+)?cumprimento\s+de\s+senten[cç]a\b|\bcumprimento\s+provis[oó]rio\b|\binicio\s+do\s+cumprimento\b|\bexecu[cç][aã]o\s+de\s+senten[cç]a\b|\bpeti[cç][aã]o\s+de\s+cumprimento\b|\brequer\s+o\s+cumprimento\b|\bautos\s+de\s+cumprimento\b/i;

/** Ainda só fase de conhecimento / falta executar. */
const RE_SEM_CUMPRIMENTO_HINT =
  /\b(aguarde-se\s+o\s+tr[aâ]nsito|certifique-se\s+o\s+tr[aâ]nsito|ap[oó]s\s+o\s+tr[aâ]nsito|nada\s+requerido|sem\s+requerimento\s+de\s+cumprimento)\b/i;

export type ProcedenteSemCumprimento = {
  isProcedenteAutor: boolean;
  isParcial: boolean;
  isImprocedente: boolean;
  cumprimentoInstaurado: boolean;
  elegivel: boolean;
  label: string;
  motivo: string;
};

export function analisarProcedenteSemCumprimento(texto: string): ProcedenteSemCumprimento {
  const t = String(texto || "");
  const isParcial = RE_PARCIAL.test(t);
  const isImprocedente = RE_IMPROCEDENTE.test(t) && !isParcial;
  const isProcedenteAutor =
    !isImprocedente &&
    (RE_JULGO_PROCEDENTE_AUTOR.test(t) || RE_PROCEDENTE_CLARO.test(t) || isParcial);
  const cumprimentoInstaurado = RE_CUMPRIMENTO_INSTAURADO.test(t);

  const elegivel = isProcedenteAutor && !cumprimentoInstaurado;

  let label = "NÃO CLASSIFICADO";
  let motivo = "";
  if (isImprocedente) {
    label = "IMPROCEDENTE";
    motivo = "Sentença desfavorável ao autor";
  } else if (elegivel && isParcial) {
    label = "PROCEDENTE EM PARTE · SEM CUMPRIMENTO";
    motivo = "Julgado parcialmente procedente ao autor — não há indício de cumprimento instaurado";
  } else if (elegivel) {
    label = "JULGO PROCEDENTE · SEM CUMPRIMENTO";
    motivo =
      "Linguagem clara de procedência ao autor e sem cumprimento de sentença instaurado no teor";
  } else if (isProcedenteAutor && cumprimentoInstaurado) {
    label = "PROCEDENTE · CUMPRIMENTO JÁ INSTAURADO";
    motivo = "Já há menção a cumprimento/execução de sentença";
  } else if (cumprimentoInstaurado) {
    label = "CUMPRIMENTO INSTAURADO";
    motivo = "Teor cita cumprimento de sentença";
  }

  if (elegivel && RE_SEM_CUMPRIMENTO_HINT.test(t)) {
    motivo += " · indício de aguardo pós-trânsito";
  }

  return {
    isProcedenteAutor,
    isParcial,
    isImprocedente,
    cumprimentoInstaurado,
    elegivel,
    label,
    motivo,
  };
}

/** Queries DJEN focadas em procedência ao autor (não “vendo carro”). */
export function queriesProcedenteSemCumprimento(): string[] {
  // Frases curtas: o índice DJEN responde melhor do que textos longos
  return [
    "julgo procedente",
    "julgo procedentes",
    "pedido procedente",
    "pedidos procedentes",
    "sentença procedente",
    "parcialmente procedente",
    "procedente o pedido do autor",
    "julgo procedente o pedido formulado",
  ];
}

const MS_ANO = 365.25 * 86400000;

/** Publicação / data do ato com idade em anos (ex.: 4.0 = ~4 anos). */
export function idadeAnosDaData(isoOrBr: string | null | undefined): number | null {
  if (!isoOrBr) return null;
  const s = String(isoOrBr).trim();
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s.slice(0, 10));
  else {
    const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) d = new Date(+m[3], +m[2] - 1, +m[1]);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / MS_ANO;
}

/** Janela crítica: ≥ minAnos e < maxAnos (default 4–5: perto da prescrição da execução). */
export function naJanelaPrescricao(
  data: string | null | undefined,
  minAnos = 4,
  maxAnos = 5.2
): boolean {
  const y = idadeAnosDaData(data);
  if (y == null) return false;
  return y >= minAnos && y < maxAnos;
}

export function rotuloIdade(data: string | null | undefined): string {
  const y = idadeAnosDaData(data);
  if (y == null) return "";
  if (y >= 4 && y < 5.2) return `PARADO ~${y.toFixed(1)}a · RISCO PRESCRIÇÃO (~5a)`;
  if (y >= 5.2) return `~${y.toFixed(1)}a · verificar prescrição`;
  return `~${y.toFixed(1)} anos`;
}
