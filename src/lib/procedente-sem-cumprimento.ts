/**
 * Sentença procedente (favorável ao autor) SEM cumprimento de sentença instaurado.
 * ICP: revisional / bancário / cível — NÃO ação penal.
 */

const RE_JULGO_PROCEDENTE_AUTOR =
  /julgo\s+procedente[s]?\s+(em\s+parte\s+)?(o[s]?\s+)?pedido[s]?\s+(do\s+autor|da\s+autora|da\s+parte\s+autora)?/i;

const RE_PROCEDENTE_CLARO =
  /\bjulgo\s+procedente\b|\bjulgo\s+procedentes\b|\bdeclaro\s+procedente\b|\bpedido[s]?\s+(do\s+autor\s+)?procedente[s]?\b|\bsenten[cç]a\s+(parcialmente\s+)?procedente\b/i;

const RE_PARCIAL = /procedente\s+em\s+parte|parcialmente\s+procedente/i;

const RE_IMPROCEDENTE =
  /\bjulgo\s+improcedente\b|\bpedido[s]?\s+improcedente|\bsenten[cç]a\s+improcedente\b/i;

const RE_CUMPRIMENTO_INSTAURADO =
  /\b(instaur[oa]\w*\s+)?cumprimento\s+de\s+senten[cç]a\b|\bcumprimento\s+provis[oó]rio\b|\binicio\s+do\s+cumprimento\b|\bexecu[cç][aã]o\s+de\s+senten[cç]a\b|\bpeti[cç][aã]o\s+de\s+cumprimento\b|\brequer\s+o\s+cumprimento\b|\bautos\s+de\s+cumprimento\b/i;

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

export function isEsferaPenal(texto: string): boolean {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\bacao penal\b/.test(t)) return true;
  if (/\bprocesso penal\b/.test(t)) return true;
  if (/\binquerito policial\b/.test(t)) return true;
  if (/\bexecucao penal\b/.test(t)) return true;
  if (/\bcodigo penal\b/.test(t)) return true;
  if (/\btribunal do juri\b|\bjuri popular\b/.test(t)) return true;
  if (/\bmedida de seguranca\b/.test(t)) return true;
  if (/\bpenal\s*[-–]\s*procedimento/.test(t)) return true;
  if (/\bprocedimento\s+(sumario|ordinario)\b/.test(t) && /\bpenal\b/.test(t)) return true;
  if (/acao penal/.test(t)) return true;
  return false;
}

export function isRevisionalOuBancarioCivel(texto: string): boolean {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (isEsferaPenal(t)) return false;
  if (/\bprocedimento comum infancia|\bvara da infancia|\binfancia e juventude\b/.test(t)) return false;
  if (/\brevisional\b/.test(t)) return true;
  if (/\brevisao de (contrato|clausula|juros)\b/.test(t)) return true;
  if (/\bcontrato[s]? bancario/.test(t)) return true;
  if (/\balienacao fiduciaria\b/.test(t)) return true;
  if (/\bbusca e apreensao\b/.test(t)) return true;
  if (/\bfinanciamento\b/.test(t)) return true;
  if (/\bconsignado\b/.test(t)) return true;
  if (/\bcdc\b|\bcodigo de defesa do consumidor\b/.test(t)) return true;
  if (/\bsuperendividamento\b/.test(t)) return true;
  if (/\bindebito\b/.test(t)) return true;
  if (/\bbanco\b|\bfinanceira\b|\bcredor fiduciario\b/.test(t)) return true;
  if (/\bprocedimento comum civel\b/.test(t)) return true;
  if (/\bcivel\b/.test(t) && !/\bpenal\b/.test(t)) return true;
  return false;
}

export function analisarProcedenteSemCumprimento(texto: string): ProcedenteSemCumprimento {
  const t = String(texto || "");
  const isParcial = RE_PARCIAL.test(t);
  const isImprocedente = RE_IMPROCEDENTE.test(t) && !isParcial;
  const isProcedenteAutor =
    !isImprocedente &&
    (RE_JULGO_PROCEDENTE_AUTOR.test(t) || RE_PROCEDENTE_CLARO.test(t) || isParcial);
  const cumprimentoInstaurado = RE_CUMPRIMENTO_INSTAURADO.test(t);

  // Penal nunca elegível neste módulo
  if (isEsferaPenal(t)) {
    return {
      isProcedenteAutor,
      isParcial,
      isImprocedente,
      cumprimentoInstaurado,
      elegivel: false,
      label: "EXCLUÍDO · AÇÃO PENAL",
      motivo: "Esfera penal — fora do ICP revisional/bancário",
    };
  }

  const elegivel =
    isProcedenteAutor && !cumprimentoInstaurado && isRevisionalOuBancarioCivel(t);

  let label = "NÃO CLASSIFICADO";
  let motivo = "";
  if (isImprocedente) {
    label = "IMPROCEDENTE";
    motivo = "Sentença desfavorável ao autor";
  } else if (isProcedenteAutor && !cumprimentoInstaurado && !isRevisionalOuBancarioCivel(t)) {
    label = "PROCEDENTE · FORA DO ICP";
    motivo = "Procedente, mas não revisional/bancário/cível do funil (ex.: outra área)";
  } else if (elegivel && isParcial) {
    label = "PROCEDENTE EM PARTE · SEM CUMPRIMENTO";
    motivo = "Revisional/cível · parcial ao autor · sem cumprimento instaurado";
  } else if (elegivel) {
    label = "JULGO PROCEDENTE · SEM CUMPRIMENTO";
    motivo = "Revisional/bancário/cível · procedência ao autor · sem cumprimento no teor";
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

/** Queries DJEN: procedente + revisional (evita puxar ação penal). */
export function queriesProcedenteSemCumprimento(): string[] {
  return [
    "julgo procedente revisional",
    "procedente revisional",
    "sentença procedente revisional",
    "parcialmente procedente revisional",
    "julgo procedente contrato bancário",
    "julgo procedente alienação fiduciária",
    "procedente repetição de indébito",
    "julgo procedente financiamento",
    "julgo procedente procedimento comum cível",
  ];
}

const MS_ANO = 365.25 * 86400000;

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
