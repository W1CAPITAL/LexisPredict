/**
 * Cliente Bacen SGS (dados abertos) — séries de juros % a.m.
 * API pública: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
 * Sem token. Cache em memória no server (processo Vercel).
 */

export const SERIES_BACEN = {
  /** Aquisição de veículos PF — recursos livres — % a.m. */
  VEICULOS_PF: 25471,
  /** Crédito pessoal não consignado PF — % a.m. */
  CREDITO_PESSOAL: 20742,
  /** Cheque especial PF — % a.m. */
  CHEQUE_ESPECIAL: 25463,
  /** Taxa média juros operações crédito — total */
  MEDIA_GERAL: 20714,
  /** SELIC meta % a.a. (diária) */
  SELIC: 11,
} as const;

export type SerieBacenKey = keyof typeof SERIES_BACEN;

export type PontoSerie = { data: string; valor: number };

type CacheEntry = { at: number; pontos: PontoSerie[] };
const memCache = new Map<number, CacheEntry>();
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function parseBRDate(s: string): string {
  // "01/03/2024" -> 2024-03-01
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function fetchSerieBacen(
  codigo: number,
  dataInicial?: string,
  dataFinal?: string
): Promise<PontoSerie[]> {
  const cached = memCache.get(codigo);
  if (cached && Date.now() - cached.at < TTL_MS && !dataInicial) {
    return cached.pontos;
  }

  let url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json`;
  if (dataInicial && dataFinal) {
    url += `&dataInicial=${encodeURIComponent(dataInicial)}&dataFinal=${encodeURIComponent(dataFinal)}`;
  }

  const res = await fetch(url, {
    next: { revalidate: 43200 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Bacen SGS ${codigo}: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Array<{ data: string; valor: string }>;
  const pontos: PontoSerie[] = (raw || [])
    .map((r) => ({
      data: parseBRDate(r.data),
      valor: Number(String(r.valor).replace(',', '.')),
    }))
    .filter((p) => Number.isFinite(p.valor));

  if (!dataInicial) {
    memCache.set(codigo, { at: Date.now(), pontos });
  }
  return pontos;
}

/** Último valor da série (mais recente). */
export async function taxaMediaMaisRecente(codigo: number): Promise<{
  data: string;
  valor: number;
  codigo: number;
} | null> {
  const pts = await fetchSerieBacen(codigo);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  return { data: last.data, valor: last.valor, codigo };
}

/**
 * Taxa na data da contratação (ou o ponto mensal imediatamente anterior).
 * dataContrato: YYYY-MM-DD
 */
export async function taxaMediaNaData(
  codigo: number,
  dataContrato: string
): Promise<{ data: string; valor: number; codigo: number } | null> {
  const alvo = dataContrato.slice(0, 10);
  // busca janela ampla
  const ini = '01/01/2015';
  const [y, m, d] = alvo.split('-');
  const fim = `${d}/${m}/${y}`;
  try {
    const pts = await fetchSerieBacen(codigo, ini, fim);
    if (!pts.length) return taxaMediaMaisRecente(codigo);
    let best = pts[0];
    for (const p of pts) {
      if (p.data <= alvo) best = p;
      else break;
    }
    return { data: best.data, valor: best.valor, codigo };
  } catch {
    return taxaMediaMaisRecente(codigo);
  }
}

export function labelSerie(codigo: number): string {
  const entry = Object.entries(SERIES_BACEN).find(([, c]) => c === codigo);
  if (!entry) return `SGS ${codigo}`;
  const map: Record<string, string> = {
    VEICULOS_PF: 'Veículos PF (25471)',
    CREDITO_PESSOAL: 'Crédito pessoal (20742)',
    CHEQUE_ESPECIAL: 'Cheque especial (25463)',
    MEDIA_GERAL: 'Média geral crédito (20714)',
    SELIC: 'Selic (11)',
  };
  return map[entry[0]] || entry[0];
}
