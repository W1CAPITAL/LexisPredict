/**
 * Normaliza movimentos DataJud e itens DJEN para Cronologia Unificada.
 */
export function normalizeDataJudMovimento(m: any) {
  if (!m || typeof m !== 'object') {
    return { dataHora: null, nome: 'Movimentação', complemento: '', raw: m };
  }
  const dataHora =
    m.dataHora ||
    m.data ||
    m.date ||
    m.dataMovimento ||
    m.data_hora ||
    (m.complementoTabelado && m.complementoTabelado.data) ||
    null;
  const nome =
    m.nome ||
    m.nomeMovimento ||
    m.descricao ||
    m.movimento ||
    m.titulo ||
    (typeof m.codigo === 'number' ? `Cód. ${m.codigo}` : null) ||
    'Movimentação tribunal';
  let complemento = m.complemento || m.observacao || '';
  if (!complemento && Array.isArray(m.complementosTabelados)) {
    complemento = m.complementosTabelados
      .map((c: any) => c?.nome || c?.descricao || '')
      .filter(Boolean)
      .join(' · ');
  } else if (!complemento && m.complementoTabelado?.nome) {
    complemento = m.complementoTabelado.nome;
  }
  return { ...m, dataHora, nome: String(nome), complemento: String(complemento || '') };
}

export function parseTimelineDate(raw: any): Date {
  if (!raw) return new Date(0);
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = String(raw).trim();
  if (!s) return new Date(0);
  // ISO
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

export function normalizeMovimentosList(movs: any[] | null | undefined): any[] {
  if (!Array.isArray(movs)) return [];
  return movs
    .map(normalizeDataJudMovimento)
    .sort((a, b) => parseTimelineDate(b.dataHora).getTime() - parseTimelineDate(a.dataHora).getTime());
}

export type UnifiedTimelineItem = {
  type: 'court' | 'djen';
  date: Date;
  title: string;
  subtitle: string;
  raw: any;
};

function normalizeDjenLabel(value: any): string {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCasePt(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)([a-záàâãéêíóôõúç])/g, (_m, p1, p2) => p1 + String(p2).toLocaleUpperCase("pt-BR"));
}

/**
 * Título comercial do DJEN.
 *
 * O campo tipoComunicacao frequentemente vem como "Intimação" mesmo quando
 * o documento publicado é sentença, decisão ou acórdão. Por isso:
 * 1) detectamos o documento específico;
 * 2) preservamos "Intimação — X" quando a comunicação é uma intimação;
 * 3) evitamos usar o início do teor como título.
 */
export function resolveDjenPublicationTitle(d: any): string {
  const tipoComunicacaoRaw = normalizeDjenLabel(
    d?.tipoComunicacao ?? d?.tipo_comunicacao ?? d?.tipo
  );
  const tipoDocumentoRaw = normalizeDjenLabel(
    d?.tipoDocumento ?? d?.tipo_documento ?? d?.documentoTipo
  );
  const texto = String(
    d?.texto ??
    d?.conteudo ??
    d?.textoPublicacao ??
    d?.descricao ??
    d?.inteiroTeor ??
    ""
  );

  const haystack = `${tipoDocumentoRaw}\n${tipoComunicacaoRaw}\n${texto.slice(0, 12000)}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  let specific = "";

  // Ordem do mais específico para o mais genérico.
  if (/\bACORDAO\b|\bACÓRDÃO\b/.test(haystack)) specific = "Acórdão";
  else if (/\bSENTENCA\b|\bSENTENÇA\b/.test(haystack)) specific = "Sentença";
  else if (/\bDECISAO\s+MONOCRATICA\b|\bDECISÃO\s+MONOCRÁTICA\b/.test(haystack)) specific = "Decisão Monocrática";
  else if (/\bDECISAO\b|\bDECISÃO\b/.test(haystack)) specific = "Decisão";
  else if (/\bDESPACHO\b/.test(haystack)) specific = "Despacho";
  else if (/\bEDITAL\b/.test(haystack)) specific = "Edital";
  else if (/\bCITACAO\b|\bCITAÇÃO\b/.test(haystack)) specific = "Citação";
  else if (/\bPAUTA\s+DE\s+JULGAMENTO\b|\bPAUTA\b/.test(haystack)) specific = "Pauta de Julgamento";
  else if (/\bAUDIENCIA\b|\bAUDIÊNCIA\b/.test(haystack)) specific = "Audiência";
  else if (/\bCERTIDAO\b|\bCERTIDÃO\b/.test(haystack)) specific = "Certidão";
  else if (/\bATO\s+ORDINATORIO\b|\bATO\s+ORDINATÓRIO\b/.test(haystack)) specific = "Ato Ordinatório";
  else if (/\bNOTIFICACAO\b|\bNOTIFICAÇÃO\b/.test(haystack)) specific = "Notificação";
  else if (/\bINTIMACAO\b|\bINTIMAÇÃO\b|\bINTIMADO\b|\bINTIMEM-SE\b/.test(haystack)) specific = "Intimação";

  const communication = tipoComunicacaoRaw
    ? titleCasePt(tipoComunicacaoRaw)
    : "";
  const documentType = tipoDocumentoRaw
    ? titleCasePt(tipoDocumentoRaw)
    : "";

  const communicationIsGeneric =
    !communication ||
    /^(Publicacao|Publicação|Comunicacao|Comunicação|Diario|Diário|Djen)$/i.test(communication);

  const isIntimacaoCommunication = /intima/i.test(communication);

  if (isIntimacaoCommunication && specific && specific !== "Intimação") {
    return `Intimação — ${specific}`;
  }

  if (documentType && !/^(Documento|Publicacao|Publicação|Comunicacao|Comunicação)$/i.test(documentType)) {
    if (isIntimacaoCommunication && !/intima/i.test(documentType)) {
      return `Intimação — ${documentType}`;
    }
    return documentType;
  }

  if (specific) return specific;
  if (!communicationIsGeneric) return communication;
  return "Publicação DJEN";
}

export function buildUnifiedTimeline(
  movimentos: any[] | null | undefined,
  comunicacoes: any[] | null | undefined
): UnifiedTimelineItem[] {
  const movs = (movimentos || []).map((m) => {
    const n = normalizeDataJudMovimento(m);
    return {
      type: 'court' as const,
      date: parseTimelineDate(n.dataHora),
      title: n.nome || 'Movimentação',
      subtitle: n.complemento || '',
      raw: n,
    };
  });
  const djen = (comunicacoes || []).map((d) => {
    const data =
      d?.data_disponibilizacao || d?.dataDisponibilizacao || d?.data || null;
    const title = resolveDjenPublicationTitle(d);
    return {
      type: 'djen' as const,
      date: parseTimelineDate(data),
      title,
      subtitle: String(d?.nomeOrgao || d?.siglaTribunal || ''),
      raw: d,
    };
  });
  return [...movs, ...djen]
    .filter((x) => x.date.getTime() > 0 || x.title)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
