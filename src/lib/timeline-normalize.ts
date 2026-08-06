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
    const texto = String(d?.texto || d?.conteudo || d?.inteiroTeor || '');
    const title =
      d?.tipoComunicacao ||
      d?.tipoDocumento ||
      (texto ? texto.slice(0, 120) : 'Publicação DJEN');
    return {
      type: 'djen' as const,
      date: parseTimelineDate(data),
      title: String(title),
      subtitle: String(d?.nomeOrgao || d?.siglaTribunal || ''),
      raw: d,
    };
  });
  return [...movs, ...djen]
    .filter((x) => x.date.getTime() > 0 || x.title)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}
