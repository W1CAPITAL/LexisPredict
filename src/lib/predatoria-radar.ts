/**
 * Radar de litigância / advocacia potencialmente predatória.
 * Sinais em DataJud/DJEN/Comunica — não consulta processo ético sigiloso da OAB.
 */

export type PredatoriaSignal = {
  code: string;
  label: string;
  weight: number;
  evidence?: string;
};

export type PredatoriaRisk = {
  score: number;
  band: 'baixo' | 'atencao' | 'elevado' | 'critico';
  signals: PredatoriaSignal[];
  summary: string;
};

/** Termos reais do Comunica/DJEN (NUMOPED sem E final também) */
export const PREDATORIA_KEYWORDS: Array<{ re: RegExp; code: string; label: string; weight: number }> = [
  { re: /advocacia\s+predat[oó]ria/i, code: 'ADV_PRED', label: 'Menção a advocacia predatória', weight: 35 },
  { re: /litig[aâ]ncia\s+predat[oó]ria/i, code: 'LIT_PRED', label: 'Menção a litigância predatória', weight: 35 },
  { re: /litig[aâ]ncia\s+abusiva/i, code: 'LIT_ABUS', label: 'Menção a litigância abusiva', weight: 28 },
  { re: /demandas?\s+predat[oó]rias?/i, code: 'DEM_PRED', label: 'Demandas predatórias', weight: 30 },
  // NUMOPED / NUMOPEDE / N.U.M.O.P.E.D.E / núcleo de monitoramento
  {
    re: /\bnumoped[ei]?\b|n\s*[\.\-]?\s*u\s*[\.\-]?\s*m\s*[\.\-]?\s*o\s*[\.\-]?\s*p\s*[\.\-]?\s*e\s*[\.\-]?\s*d\s*[\.\-]?\s*e?\b/i,
    code: 'NUMOPEDE',
    label: 'Referência NUMOPED(E)',
    weight: 40,
  },
  {
    re: /n[uú]cleo\s+de\s+monitoramento\s+(de\s+)?perfis?|monitoramento\s+de\s+perfis?\s+de\s+demandas?/i,
    code: 'NUMOPEDE',
    label: 'Núcleo de monitoramento de perfis',
    weight: 38,
  },
  { re: /recomenda[cç][aã]o\s*(n[ºo°.]?\s*)?159/i, code: 'CNJ159', label: 'Recomendação CNJ 159', weight: 22 },
  {
    re: /comunica[cç][aã]o\s+[àa]\s+oab|of[ií]cie[\-\s]?se\s+[àa]\s+oab|remessa\s+[àa]\s+oab|cientifique[\-\s]?se\s+a\s+oab/i,
    code: 'OAB_COM',
    label: 'Comunicação / ofício à OAB',
    weight: 30,
  },
  { re: /capta[cç][aã]o\s+indevida\s+de\s+clientela|capta[cç][aã]o\s+de\s+clientela/i, code: 'CAPTACAO', label: 'Captação de clientela', weight: 24 },
  { re: /peti[cç][oõ]es?\s+padronizadas?|iniciais?\s+padronizadas?/i, code: 'PADRAO', label: 'Iniciais/petições padronizadas', weight: 12 },
];

function snippetAround(text: string, re: RegExp, max = 160): string | undefined {
  const m = re.exec(text);
  if (!m || m.index == null) return undefined;
  const i = m.index;
  return text.slice(Math.max(0, i - 40), Math.min(text.length, i + max)).replace(/\s+/g, ' ').trim();
}

export function scanTextForPredatoria(
  text: string,
  opts?: { oabNumbers?: string[] }
): PredatoriaSignal[] {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  // HTML → texto aproximado
  const t = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');

  const out: PredatoriaSignal[] = [];
  const seen = new Set<string>();

  for (const k of PREDATORIA_KEYWORDS) {
    if (k.re.test(t)) {
      if (seen.has(k.code)) continue;
      seen.add(k.code);
      out.push({
        code: k.code,
        label: k.label,
        weight: k.weight,
        evidence: snippetAround(t, k.re),
      });
    }
  }

  // OAB no teor (ex. 472089) + contexto NUMOPED/predatória
  const oabs = (opts?.oabNumbers || [])
    .map((n) => String(n).replace(/\D/g, ''))
    .filter((n) => n.length >= 4 && n.length <= 8);
  const hasPredContext =
    /\bnumoped[ei]?\b|predat[oó]ria|monitoramento\s+de\s+perfil|recomenda[cç][aã]o\s*159|comunica[cç][aã]o\s+[àa]\s+oab/i.test(
      t
    );

  for (const digits of oabs) {
    const reOab = new RegExp(`\\b${digits}\\b`);
    if (reOab.test(t) && hasPredContext) {
      const code = `OAB_${digits}`;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push({
        code: 'NUMOPEDE_OAB',
        label: `OAB ${digits} no teor com contexto NUMOPED/predatória`,
        weight: 42,
        evidence: snippetAround(t, reOab),
      });
      // também marca NUMOPEDE genérico
      if (!seen.has('NUMOPEDE')) {
        seen.add('NUMOPEDE');
        out.push({
          code: 'NUMOPEDE',
          label: 'NUMOPED(E) + OAB no teor',
          weight: 40,
          evidence: snippetAround(t, reOab),
        });
      }
    }
  }

  return out;
}

export function scorePredatoria(
  signals: PredatoriaSignal[],
  extras?: { volumeCases?: number }
): PredatoriaRisk {
  const merged = [...signals];
  if (extras?.volumeCases && extras.volumeCases >= 30) {
    merged.push({
      code: 'VOL',
      label: `Volume alto na amostra (${extras.volumeCases})`,
      weight: Math.min(15, Math.floor(extras.volumeCases / 10)),
    });
  }
  const score = Math.min(
    100,
    merged.reduce((s, x) => s + (x.weight || 0), 0)
  );
  let band: PredatoriaRisk['band'] = 'baixo';
  if (score >= 70) band = 'critico';
  else if (score >= 45) band = 'elevado';
  else if (score >= 22) band = 'atencao';

  const summary =
    merged.length === 0
      ? 'Sem sinais textuais fortes na amostra. Isso NÃO prova ausência de apuração sigilosa.'
      : merged
          .slice(0, 4)
          .map((s) => s.label)
          .join(' · ');

  return { score, band, signals: merged, summary };
}

export function normalizeLawyerKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(dr|dra|advogado|advogada)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasNumopedeSignal(signals: PredatoriaSignal[]): boolean {
  return signals.some((s) =>
    ['NUMOPEDE', 'NUMOPEDE_OAB', 'ADV_PRED', 'LIT_PRED', 'DEM_PRED', 'CNJ159', 'OAB_COM', 'EXT_PRED'].includes(
      s.code
    )
  );
}

export function isNumopedeOnly(signals: PredatoriaSignal[]): boolean {
  return signals.some(
    (s) =>
      s.code === 'NUMOPEDE' ||
      s.code === 'NUMOPEDE_OAB' ||
      /numoped/i.test(s.label + (s.evidence || ''))
  );
}

/** Extrai OABs de um texto de inscrição (472.089/SP, OAB 472089, etc.) */
export function extractOabDigitsFromLabel(label: string): string[] {
  const s = String(label || '');
  const out = new Set<string>();
  for (const m of s.matchAll(/\b(\d{4,7})\b/g)) {
    out.add(m[1]);
  }
  // formatos 472.089
  for (const m of s.matchAll(/\b(\d{1,3})\.(\d{3})\b/g)) {
    out.add(`${m[1]}${m[2]}`.replace(/^0+/, '') || m[0].replace(/\D/g, ''));
  }
  return Array.from(out);
}
