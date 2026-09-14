/**
 * Flags opcionais do modo B.A. no gerador DJEN (fora da carteira).
 * Só atuam quando o usuário ativa o chip correspondente.
 */
import { isClasseBuscaApreensao, normalizarTextoBa } from "@/lib/ba-evidence";

/** Publicação é de busca e apreensão (classe ou teor). */
export function isPublicacaoBuscaApreensao(nomeClasse: unknown, texto: unknown): boolean {
  const blob = `${nomeClasse || ""} ${texto || ""}`;
  return (
    isClasseBuscaApreensao(nomeClasse) ||
    isClasseBuscaApreensao(blob) ||
    /busca\s+e\s+apreens/i.test(String(blob))
  );
}

/**
 * Início / fase inicial da B.A.: distribuição, citação, liminar, expedição de mandado.
 * Exclui fases avançadas (leilão, consolidação, cumprimento, alienação já consolidada).
 */
export function isBaInicioProcesso(texto: unknown, nomeClasse?: unknown): boolean {
  const t = normalizarTextoBa(`${nomeClasse || ""} ${texto || ""}`);
  if (!t) return false;

  // Fases avançadas → não é início
  if (
    /\bLEILAO\b|\bHASTA\b|\bCONSOLIDACAO\s+DA\s+PROPRIEDADE\b|\bARREMATACAO\b/.test(t)
  ) {
    return false;
  }
  if (/\bCUMPRIMENTO\s+DE\s+SENTENCA\b|\bEXECUCAO\s+DE\s+TITULO\b/.test(t)) {
    return false;
  }
  if (/\bSENTENCA\s+(?:DE\s+)?PROCEDENCIA|\bJULGO\s+PROCEDENTE|\bTRANSITO\s+EM\s+JULGADO\b/.test(t)) {
    return false;
  }

  const inicio =
    /\bDISTRIBUICAO\b|\bDISTRIBUIDO\b|\bAUTOS\s+DISTRIBUIDOS\b/.test(t) ||
    /\bCITACAO\b|\bCITE[- ]SE\b|\bCITADO\b/.test(t) ||
    /\bLIMINAR\b/.test(t) && (/\bDEFIRO\b|\bDEFERIDA\b|\bDETERMINO\b|\bEXPED/.test(t) || /BUSCA/.test(t)) ||
    /\bEXPEDICAO\s+DE\s+MANDADO\b|\bEXPECA[- ]SE\s+MANDADO\b|\bMANDADO\s+DE\s+BUSCA\b/.test(t) ||
    /\bFASE\s+INICIAL\b|\bINICIAL\s+PROTOCOLADA\b|\bPETICAO\s+INICIAL\b/.test(t) ||
    /\bDEFIRO\s+.{0,40}BUSCA\s+E\s+APREENSAO\b|\bDETERMINO\s+.{0,40}APREENSAO\b/.test(t) ||
    /\bINTIME[- ]SE\s+.{0,60}FIDUCI/.test(t);

  return inicio;
}

/**
 * Sem advogado identificável no teor: sem OAB da parte autora / menção explícita.
 * Não confunde com OAB do juízo ou "advogado dativo" genérico sem número.
 */
export function isSemAdvogadoNoTeor(texto: unknown): boolean {
  const raw = String(texto || "");
  const t = normalizarTextoBa(raw);

  // Menção explícita
  if (
    /\bSEM\s+ADVOGADO\b|\bNAO\s+CONSTA\s+ADVOGADO\b|\bPARTE\s+SEM\s+PATRONO\b|\bEM\s+CAUSA\s+PROPRIA\b|\bJUS\s+POSTULANDI\b/.test(
      t
    )
  ) {
    return true;
  }

  // Há OAB típica (UF 123456) → tem advogado
  if (/\bOAB\s*[\/\-]?\s*[A-Z]{2}\s*[nNº°\.]*\s*\d{3,6}\b/i.test(raw)) return false;
  if (/\bOAB\s*[\/\-]\s*[A-Z]{2}\b/i.test(raw) && /\d{3,6}/.test(raw)) return false;

  // "Dr(a)." + nome + OAB pattern already covered; "advogado:" sozinho sem número ainda conta como possível
  if (/\bADVOGADO[A]?\s*[:\-]\s*[A-ZÀ-Ú]{3,}/.test(t) && /\d{3,6}/.test(raw)) return false;

  // Sem nenhum indício de OAB no texto → trata como sem advogado no teor público
  if (!/\bOAB\b/i.test(raw)) return true;

  // Só a palavra OAB sem número de inscrição
  if (/\bOAB\b/i.test(raw) && !/\d{3,6}/.test(raw)) return true;

  return false;
}

/** Queries DJEN quando flag "início do processo" está ativa. */
export function queriesBaInicio(): string[] {
  return [
    "busca e apreensao liminar",
    "defiro a liminar de busca e apreensao",
    "expedicao de mandado de busca",
    "mandado de busca e apreensao",
    "busca e apreensao cite-se",
    "distribuicao busca e apreensao",
  ];
}

/** Queries base do modo só B.A. */
export function queriesBaBase(): string[] {
  return [
    "busca e apreensao",
    "busca e apreensão",
    "alienacao fiduciaria",
    "mandado de busca e apreensao",
    "acao de busca e apreensao",
    "busca e apreensao em alienacao fiduciaria",
  ];
}
