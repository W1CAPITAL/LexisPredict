import { normalizarTextoBa } from "@/lib/ba-evidence";

const BA = /\bBUSCA\s+E\s+APREENSAO\b/;
const textoBa = (texto: unknown, classe?: unknown) => normalizarTextoBa(`${classe ?? ""} ${texto ?? ""}`);

/** Esfera penal é sempre excluída do modo veículo, mesmo com veículo no teor. */
export function isBaCriminalOuTrafico(texto: unknown, nomeClasse?: unknown): boolean {
  const t = textoBa(texto, nomeClasse);
  return /\b(?:ACAO|PROCESSO)\s+PENAL\b|\bINQUERITO\b|\bCRIMINAL\b|\bCODIGO\s+(?:DE\s+PROCESSO\s+)?PENAL\b|\bCP(?:P)?\b/.test(t)
    || /\bTRAFICO\b|\bENTORPECENTES?\b|\bLEI\s+(?:N[.º°O]*\s*)?11[.\s]?343\b|\bARMAS?\s+DE\s+FOGO\b/.test(t)
    || /\bJURI\b|\bEXECUCAO\s+PENAL\b/.test(t)
    || (/\bHOMICIDIO\b|\bROUBO\b|\bFURTO\b|\bLATROCINIO\b/.test(t) && BA.test(t))
    || (/\bDELEGACIA\b|\bDELEGADO\b/.test(t) && /MANDADO\s+DE\s+BUSCA/.test(t))
    || /\bMANDADO\s+(?:DE\s+BUSCA(?:\s+E\s+APREENSAO)?\s+)?DOMICILIAR\b|\bAPREENSAO\s+(?:DE|DAS?)\s+(?:DROGAS?|ARMAS?|ENTORPECENTES?|MUNICOES)\b/.test(t);
}

export function isBaVeiculoOuFiduciaria(texto: unknown, nomeClasse?: unknown): boolean {
  if (isBaCriminalOuTrafico(texto, nomeClasse)) return false;
  const t = textoBa(texto, nomeClasse);
  return /\b(?:VEICULOS?|AUTOMOVEIS|AUTOMOVEL|MOTOCICLETA|CAMINHAO|CARRO|PLACA|RENAVAM|CHASSI)\b/.test(t)
    || /\bALIENACAO\s+FIDUCIARIA\b|\bFIDUCIANT[EA]\b|\bFIDUCIARI[OA]\b|\bFINANCIAMENTO\b|\bBANCO\b|\bFINANCEIRA\b/.test(t)
    || /\b(?:DECRETO[- ]LEI|D\.?\s*L\.?)\s*(?:N[.º°O]*\s*)?911\b/.test(t)
    || (BA.test(t) && /\bCIVEL\b|\bPROCEDIMENTO\s+COMUM\b/.test(t));
}

export function isPublicacaoBuscaApreensao(nomeClasse: unknown, texto: unknown, opts?: { modoCriminal?: boolean }): boolean {
  const blob = textoBa(texto, nomeClasse);
  if (!BA.test(blob)) return false;
  if (opts?.modoCriminal) return isBaCriminalOuTrafico(texto, nomeClasse);
  // Veículo/padrão: aceita B.A. cível/fiduciária OU qualquer B.A. que não seja criminal
  if (isBaCriminalOuTrafico(texto, nomeClasse)) return false;
  return isBaVeiculoOuFiduciaria(texto, nomeClasse) || true;
}

/** Usa somente o ato publicado. Classe, relatório e precedente não provam início. */
export function isBaInicioProcesso(
  texto: unknown,
  nomeClasse?: unknown,
  janela?: { dataInicio: string; dataFim: string },
): boolean {
  if (!isPublicacaoBuscaApreensao(nomeClasse, texto)) return false;
  let t = normalizarTextoBa(texto)
    .replace(/<[^>]*>/g, " ")
    .replace(/[“«][\s\S]*?[”»]|"[^"]*"/g, " ");
  const repub = /\bREPUBLICA(?:CAO|DO|DA)\b/.test(t);
  const dispositivo = [...t.matchAll(/ANTE O EXPOSTO|ISTO POSTO|DIANTE DO EXPOSTO|PASSO A DECIDIR|DECIDO\s*:/g)].at(-1);
  if (dispositivo?.index !== undefined) t = t.slice(dispositivo.index);
  else if (/\bJURISPRUDENCIA\b|\bEMENTA\b|\bPRECEDENTE\b/.test(t)) return false;
  if (/\bLEILAO\b|\bHASTA\b|\bARREMATACAO\b|\bCONSOLIDACAO\s+DA\s+PROPRIEDADE\b|\bCUMPRIMENTO\s+DE\s+SENTENCA\b|\bEXECUCAO\s+DE\s+TITULO\b|\bTRANSITO\s+EM\s+JULGADO\b|\bSENTENCA\s+(?:(?:DE|DE\s+MERITO)\s+)?(?:IM)?PROCEDEN|\bJULGO\s+(?:PARCIALMENTE\s+)?(?:IM)?PROCEDENTE/.test(t)) return false;
  const novaCitacao = /\bNOVA\s+(?:DISTRIBUICAO|CITACAO)\b|\bCITE[- ]SE\s+NOVAMENTE\b/;
  if (repub && !novaCitacao.test(t)) return false;
  const mantem = /\bMANTENHO\b.{0,50}\bLIMINAR\b/.test(t);
  const trechos = t.split(/\n+|;|(?<=[.!?])\s+/);
  return trechos.some((s) => {
    if (!s.trim()) return false;
    if (/\bJURISPRUDENCIA\b|\bEMENTA\b|\bPRECEDENTE\b|\bCONFORME\b|\bHISTORICO\b|\bANTERIORMENTE\b|\bOUTRORA\b|\bHAVIA\b|\bFOI\b|\bJA\s+(?:CITAD|DISTRIBUID|DEFERID)|\bREQUER(?:EU)?\b|\bPLEITE(?:IA|OU)\b|\bSOLICIT(?:A|OU)\b/.test(s)) return false;
    if (/\bINDEFIRO\b|\bINDEFERID|\bREVOGO\b|\bREVOGAD|\bNAO\b|\bPENDENTE\b|\bAGUARD|\bSEM\s+CITACAO\b/.test(s)) return false;
    // A data do protocolo pode anteceder a publicação. Datas no relato de
    // andamento não são prova de início atual; a janela principal é da publicação.
    if (/INTIME[- ]SE|INTIMACAO/.test(s) && !/CITE[- ]SE|DEFIRO|EXPECA[- ]SE|DETERMINO/.test(s)) return false;
    if (janela && /INTIME[- ]SE|INTIMACAO|ANDAMENTO|MANTENHO|ANTIG[OA]/.test(t)) {
      const anoAto = s.match(/(?:DISTRIBUI(?:DO|DA|CAO)|CITACAO|LIMINAR\s+DEFERIDA)\s+(?:EM|DE|NO\s+ANO\s+DE)\s+(\d{4})\b/);
      if (anoAto && (anoAto[1] < janela.dataInicio.slice(0, 4) || anoAto[1] > janela.dataFim.slice(0, 4))) return false;
      const dates = [...s.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g)];
      if (dates.some(m => {
        const iso = m[4] ? `${m[4]}-${m[5]}-${m[6]}` : `${m[3]}-${m[2]}-${m[1]}`;
        return iso < janela.dataInicio || iso > janela.dataFim;
      })) return false;
    }
    const citacao = /\bCITE[- ]SE\b|\b(?:DETERMINO|ORDENO|EXPECA[- ]SE)\b.{0,35}\bCITACAO\b|^\s*(?:ATO\s+DE\s+)?CITACAO\b/.test(s);
    const distribuicao = /\bDISTRIBUICAO\b|\bDISTRIBUID[OA]S?\b/.test(s) && !/\bREDISTRIBU|\bCERTIDAO\b.{0,30}\bANTIGA\b/.test(s);
    if (mantem) return /\bCITE[- ]SE\b/.test(s) || ((citacao || distribuicao) && novaCitacao.test(s));
    return citacao || distribuicao
      || /\bPETICAO\s+INICIAL\s+(?:PROTOCOLADA|DISTRIBUIDA)\b|\bFASE\s+INICIAL\b/.test(s)
      || /\b(?:DEFIRO|CONCEDO)\b.{0,60}\bLIMINAR\b|\bLIMINAR\s+(?:DE\s+BUSCA\s+E\s+APREENSAO\s+)?DEFERIDA\b/.test(s)
      || /\b(?:EXPEDICAO|EXPECA[- ]SE)\s+(?:DE\s+|O\s+)?MANDADO\s+DE\s+(?:BUSCA|APREENSAO)\b/.test(s)
      || /\bDEFIRO\b.{0,45}\bBUSCA\s+E\s+APREENSAO\b|\b(?:DETERMINO|DETERMINADA|DETERMINACAO\s+DE)\b.{0,45}\bAPREENSAO\s+DO\s+VEICULO\b/.test(s);
  });
}

export function isSemAdvogadoNoTeor(texto: unknown): boolean {
  const t = normalizarTextoBa(texto);
  // Inscrição explícita prevalece sobre frase sobre outra parte sem patrono.
  if (/\bOAB\s*[\/:.\-]?\s*(?:[A-Z]{2}\s*[/\-]?\s*(?:N[.º°O]*\s*)?\d{3,6}|(?:N[.º°O]*\s*)?\d{3,6}\s*[/\-]\s*[A-Z]{2})\b/.test(t)) return false;
  if (/\bADVOGAD[OA]\b.{0,100}\bINSCRI(?:CAO|TO|TA)\b.{0,35}\b\d{3,6}\b/.test(t)) return false;
  return true; // Apenas ausência de inscrição no teor, não certidão de representação.
}

export const queriesBaVeiculo = () => ["busca e apreensao alienacao fiduciaria", "busca e apreensao veiculo", "busca e apreensao", "alienacao fiduciaria", "mandado de busca e apreensao veiculo"];
export const queriesBaInicio = () => ["busca e apreensao liminar", "defiro a liminar de busca e apreensao", "expedicao de mandado de busca", "busca e apreensao cite-se", "distribuicao busca e apreensao"];
export const queriesBaCriminal = () => ["busca e apreensao criminal", "mandado de busca e apreensao domiciliar", "busca e apreensao trafico", "busca e apreensao entorpecentes"];
export const queriesBaBase = queriesBaVeiculo;
