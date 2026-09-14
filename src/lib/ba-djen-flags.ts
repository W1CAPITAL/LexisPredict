/**
 * Flags e classificação B.A. no gerador DJEN (fora da carteira).
 * Padrão = B.A. de VEÍCULO (alienação fiduciária / cível).
 * Criminal é modo separado e opcional.
 */
import { isClasseBuscaApreensao, normalizarTextoBa } from "@/lib/ba-evidence";

/** Indícios de esfera criminal / tráfico / inquérito — NUNCA no modo veículo. */
export function isBaCriminalOuTrafico(texto: unknown, nomeClasse?: unknown): boolean {
  const t = normalizarTextoBa(`${nomeClasse || ""} ${texto || ""}`);
  if (!t) return false;
  if (/\bACAO\s+PENAL\b|\bPROCESSO\s+PENAL\b|\bINQUERITO\s+POLICIAL\b/.test(t)) return true;
  if (/\bCODIGO\s+PENAL\b|\bCP\s*,?\s*ART\b|\bCPP\b/.test(t)) return true;
  if (/\bTRAFICO\b|\bENTORPECENTES?\b|\sLEI\s+11\.?343\b|\bDROGAS?\b/.test(t)) return true;
  if (/\bARMAS?\b.*\bFOGO\b|\bPORTE\s+ILEGAL\b|\bLEI\s+10\.?826\b/.test(t)) return true;
  if (/\bHOMICIDIO\b|\bROUBO\b|\bFURTO\b|\bLATROCINIO\b|\bESTELIONATO\b/.test(t) && /\bBUSCA\s+E\s+APREENSAO\b/.test(t))
    return true;
  if (/\bJURI\b|\bEXECUCAO\s+PENAL\b|\bMEDIDA\s+DE\s+SEGURANCA\b/.test(t)) return true;
  if (/\bDELEGACIA\b|\bDELEGADO\b|\bPOLICIA\s+CIVIL\b|\bPOLICIA\s+MILITAR\b|\bMPF\b|\bMINISTERIO\s+PUBLICO\b.*\bDENUNCIA\b/.test(t)) {
    if (/\bBUSCA\s+E\s+APREENSAO\b|\bMANDADO\s+DE\s+BUSCA\b/.test(t)) return true;
  }
  if (/\bMANDADO\s+DE\s+BUSCA\s+E\s+APREENSAO\s+DOMICILIAR\b/.test(t)) return true;
  if (/\bAPREENSAO\s+DE\s+(?:ENTORPECENTE|DROGA|ARMAMENTO|MUNICAO)\b/.test(t)) return true;
  // classe tipicamente criminal
  if (/\bPENAL\b/.test(t) && /\bBUSCA|APREENSAO\b/.test(t)) return true;
  return false;
}

/** B.A. de veículo / fiduciária / cível (financiamento, alienação). */
export function isBaVeiculoOuFiduciaria(texto: unknown, nomeClasse?: unknown): boolean {
  const t = normalizarTextoBa(`${nomeClasse || ""} ${texto || ""}`);
  if (!t) return false;
  if (isBaCriminalOuTrafico(texto, nomeClasse)) return false;

  const veic =
    /\bVEICULO\b|\bAUTOMOVEL\b|\bCAMINHAO\b|\bMOTOCICLETA\b|\bCARRO\b|\bPLACA\b|\bRENAVAM\b|\bCHASSI\b/.test(t) ||
    /\bALIENACAO\s+FIDUCIARIA\b|\bFIDUCIANTE\b|\bFIDUCIARIO\b|\bCREDOR\s+FIDUCIARIO\b/.test(t) ||
    /\bFINANCIAMENTO\b|\bCONTRATO\s+DE\s+FINANCIAMENTO\b|\bBANCO\b|\bFINANCEIRA\b/.test(t) ||
    /\bDECRETO[- ]LEI\s+911\b|\bDL\s+911\b|\bLEI\s+13\.?043\b/.test(t) ||
    /\bBUSCA\s+E\s+APREENSAO\b/.test(t) && /\bCIVEL\b|\bPROCEDIMENTO\s+COMUM\b/.test(t);

  // classe explícita B.A. cível sem criminal
  if (isClasseBuscaApreensao(nomeClasse) && !isBaCriminalOuTrafico(texto, nomeClasse)) {
    // se tem indício criminal no teor, já retornou false acima
    // classe BA pura: exige não ser criminal; se teor só tem BA genérico, aceita como cível/veículo
    return true;
  }

  return veic || (/\bBUSCA\s+E\s+APREENSAO\b/.test(t) && !isBaCriminalOuTrafico(texto, nomeClasse));
}

/** Publicação de B.A. no modo ativo (veículo padrão ou criminal se flag). */
export function isPublicacaoBuscaApreensao(
  nomeClasse: unknown,
  texto: unknown,
  opts?: { modoCriminal?: boolean }
): boolean {
  const blob = `${nomeClasse || ""} ${texto || ""}`;
  const temBa =
    isClasseBuscaApreensao(nomeClasse) ||
    isClasseBuscaApreensao(blob) ||
    /busca\s+e\s+apreens/i.test(String(blob));

  if (!temBa) return false;

  if (opts?.modoCriminal) {
    return isBaCriminalOuTrafico(texto, nomeClasse);
  }
  // padrão: veículo/cível — exclui criminal
  if (isBaCriminalOuTrafico(texto, nomeClasse)) return false;
  return isBaVeiculoOuFiduciaria(texto, nomeClasse) || isClasseBuscaApreensao(nomeClasse);
}

export function isBaInicioProcesso(texto: unknown, nomeClasse?: unknown): boolean {
  const t = normalizarTextoBa(`${nomeClasse || ""} ${texto || ""}`);
  if (!t) return false;
  if (/\bLEILAO\b|\bHASTA\b|\bCONSOLIDACAO\s+DA\s+PROPRIEDADE\b|\bARREMATACAO\b/.test(t)) return false;
  if (/\bCUMPRIMENTO\s+DE\s+SENTENCA\b|\bEXECUCAO\s+DE\s+TITULO\b/.test(t)) return false;
  if (/\bSENTENCA\s+(?:DE\s+)?PROCEDENCIA|\bJULGO\s+PROCEDENTE|\bTRANSITO\s+EM\s+JULGADO\b/.test(t)) return false;

  return (
    /\bDISTRIBUICAO\b|\bDISTRIBUIDO\b|\bAUTOS\s+DISTRIBUIDOS\b/.test(t) ||
    /\bCITACAO\b|\bCITE[- ]SE\b|\bCITADO\b/.test(t) ||
    (/\bLIMINAR\b/.test(t) && (/\bDEFIRO\b|\bDEFERIDA\b|\bDETERMINO\b|\bEXPED/.test(t) || /BUSCA/.test(t))) ||
    /\bEXPEDICAO\s+DE\s+MANDADO\b|\bEXPECA[- ]SE\s+MANDADO\b|\bMANDADO\s+DE\s+BUSCA\b/.test(t) ||
    /\bFASE\s+INICIAL\b|\bINICIAL\s+PROTOCOLADA\b|\bPETICAO\s+INICIAL\b/.test(t) ||
    /\bDEFIRO\s+.{0,40}BUSCA\s+E\s+APREENSAO\b|\bDETERMINO\s+.{0,40}APREENSAO\b/.test(t)
  );
}

export function isSemAdvogadoNoTeor(texto: unknown): boolean {
  const raw = String(texto || "");
  const t = normalizarTextoBa(raw);

  if (
    /\bSEM\s+ADVOGADO\b|\bNAO\s+CONSTA\s+ADVOGADO\b|\bPARTE\s+SEM\s+PATRONO\b|\bEM\s+CAUSA\s+PROPRIA\b|\bJUS\s+POSTULANDI\b/.test(
      t
    )
  ) {
    return true;
  }
  if (/\bOAB\s*[\/\-]?\s*[A-Z]{2}\s*[nNº°\.]*\s*\d{3,6}\b/i.test(raw)) return false;
  if (/\bOAB\s*[\/\-]\s*[A-Z]{2}\b/i.test(raw) && /\d{3,6}/.test(raw)) return false;
  if (/\bADVOGADO[A]?\s*[:\-]\s*[A-ZÀ-Ú]{3,}/.test(t) && /\d{3,6}/.test(raw)) return false;
  if (!/\bOAB\b/i.test(raw)) return true;
  if (/\bOAB\b/i.test(raw) && !/\d{3,6}/.test(raw)) return true;
  return false;
}

export function queriesBaVeiculo(): string[] {
  return [
    "busca e apreensao alienacao fiduciaria",
    "busca e apreensao veiculo",
    "busca e apreensao",
    "alienacao fiduciaria",
    "mandado de busca e apreensao veiculo",
    "acao de busca e apreensao",
  ];
}

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

/** Só se o usuário ativar o modo criminal separado. */
export function queriesBaCriminal(): string[] {
  return [
    "busca e apreensao criminal",
    "mandado de busca e apreensao domiciliar",
    "busca e apreensao trafico",
    "busca e apreensao entorpecentes",
  ];
}

/** Alias legado */
export const queriesBaBase = queriesBaVeiculo;
