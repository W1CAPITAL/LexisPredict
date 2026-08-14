/**
 * Radar de litigância / advocacia potencialmente predatória.
 *
 * IMPORTANTE (honestidade operacional):
 * - Processos ético-disciplinares da OAB em curso são, em regra, SIGILOSOS.
 * - Não existe API pública oficial que diga "este advogado está sob investigação".
 * - Este módulo NÃO inventa investigação. Ele agrega SINAIS operacionais:
 *   (1) palavras-chave em DataJud/DJEN da carteira
 *   (2) volume / padronização na carteira interna
 *   (3) link oficial CNA/OAB para conferência de inscrição
 *   (4) registro manual de alerta pela equipe
 *
 * Referência normativa (orientação, não API): Recomendação CNJ 159/2024,
 * NUMOPEDE / centros de inteligência dos tribunais.
 */

export type PredatoriaSignal = {
  code: string;
  label: string;
  weight: number;
  evidence?: string;
};

export type PredatoriaRisk = {
  score: number; // 0–100
  band: 'baixo' | 'atencao' | 'elevado' | 'critico';
  signals: PredatoriaSignal[];
  summary: string;
};

/** Termos que aparecem em despachos/sentenças quando o juízo sinaliza o tema */
export const PREDATORIA_KEYWORDS: Array<{ re: RegExp; code: string; label: string; weight: number }> = [
  { re: /advocacia\s+predat[oó]ria/i, code: 'ADV_PRED', label: 'Menção a advocacia predatória', weight: 35 },
  { re: /litig[aâ]ncia\s+predat[oó]ria/i, code: 'LIT_PRED', label: 'Menção a litigância predatória', weight: 35 },
  { re: /litig[aâ]ncia\s+abusiva/i, code: 'LIT_ABUS', label: 'Menção a litigância abusiva', weight: 28 },
  { re: /demandas?\s+predat[oó]rias?/i, code: 'DEM_PRED', label: 'Demandas predatórias', weight: 30 },
  { re: /numopede|n[uú]cleo\s+de\s+monitoramento\s+de\s+perfis/i, code: 'NUMOPEDE', label: 'Referência NUMOPEDE / monitoramento', weight: 25 },
  { re: /recomenda[cç][aã]o\s*(n[ºo°.]?\s*)?159/i, code: 'CNJ159', label: 'Recomendação CNJ 159', weight: 22 },
  { re: /comunica[cç][aã]o\s+[àa]\s+oab|of[ií]cie[\-\s]?se\s+[àa]\s+oab|remessa\s+[àa]\s+oab/i, code: 'OAB_COM', label: 'Comunicação / ofício à OAB', weight: 30 },
  { re: /inqu[eé]rito\s+policial.*advogad|advogad[oa].*inqu[eé]rito/i, code: 'IP_ADV', label: 'Nexo inquérito × advogado', weight: 32 },
  { re: /capta[cç][aã]o\s+indevida\s+de\s+clientela|capta[cç][aã]o\s+de\s+clientela/i, code: 'CAPTACAO', label: 'Captação de clientela', weight: 24 },
  { re: /peti[cç][oõ]es?\s+padronizadas?|iniciais?\s+padronizadas?|modelo\s+padr[aã]o\s+de\s+inicial/i, code: 'PADRAO', label: 'Iniciais/petições padronizadas', weight: 12 },
  { re: /fraude\s+processual|documento\s+falso|procura[cç][aã]o\s+fraud/i, code: 'FRAUDE', label: 'Indício de fraude documental', weight: 40 },
  { re: /extingo?\s+o\s+processo.*predat|indefer.*inicial.*predat/i, code: 'EXT_PRED', label: 'Extinção/indeferimento ligado a predatória', weight: 38 },
];

export function scanTextForPredatoria(text: string): PredatoriaSignal[] {
  const t = String(text || '');
  if (!t.trim()) return [];
  const out: PredatoriaSignal[] = [];
  const seen = new Set<string>();
  for (const k of PREDATORIA_KEYWORDS) {
    const m = t.match(k.re);
    if (m && !seen.has(k.code)) {
      seen.add(k.code);
      out.push({
        code: k.code,
        label: k.label,
        weight: k.weight,
        evidence: m[0].slice(0, 120),
      });
    }
  }
  return out;
}

export function scorePredatoria(signals: PredatoriaSignal[], extras?: { volumeCases?: number }): PredatoriaRisk {
  let score = 0;
  const merged: PredatoriaSignal[] = [...signals];
  for (const s of signals) score += s.weight;

  const vol = extras?.volumeCases ?? 0;
  if (vol >= 50) {
    merged.push({ code: 'VOL_ALTO', label: `Volume alto na carteira (${vol} processos)`, weight: 15 });
    score += 15;
  } else if (vol >= 20) {
    merged.push({ code: 'VOL_MED', label: `Volume moderado na carteira (${vol} processos)`, weight: 8 });
    score += 8;
  }

  score = Math.min(100, score);
  let band: PredatoriaRisk['band'] = 'baixo';
  if (score >= 70) band = 'critico';
  else if (score >= 45) band = 'elevado';
  else if (score >= 20) band = 'atencao';

  const summary =
    band === 'critico'
      ? 'Sinais fortes de menção judicial a predatória/abuso — priorize revisão humana e CNA/OAB.'
      : band === 'elevado'
        ? 'Há menções relevantes em andamentos. Confira CNA e o teor no tribunal.'
        : band === 'atencao'
          ? 'Sinais leves ou volume elevado. Monitore; não equivale a investigação confirmada.'
          : 'Sem sinais textuais fortes na amostra analisada. Isso NÃO prova ausência de apuração sigilosa.';

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


/** Só NUMOPEDE / menção explícita a monitoramento de perfis ou litigância predatória forte */
export function hasNumopedeSignal(signals: PredatoriaSignal[]): boolean {
  return signals.some((s) =>
    ['NUMOPEDE', 'ADV_PRED', 'LIT_PRED', 'DEM_PRED', 'CNJ159', 'OAB_COM', 'EXT_PRED'].includes(s.code)
  );
}

export function isNumopedeOnly(signals: PredatoriaSignal[]): boolean {
  return signals.some((s) => s.code === 'NUMOPEDE' || /numopede/i.test(s.label + (s.evidence || '')));
}

/** Extrai OAB "SP123456" ou "OAB/SP 123.456" de texto livre */
export function extractOabFromText(text: string): { uf?: string; numero?: string } | null {
  const t = String(text || '');
  const m =
    t.match(/\bOAB[\/\s-]*([A-Z]{2})[\s.-]*(\d{3,7})\b/i) ||
    t.match(/\b([A-Z]{2})[\s.-]*(\d{4,7})\b.*OAB/i);
  if (!m) return null;
  return { uf: m[1].toUpperCase(), numero: m[2].replace(/\D/g, '') };
}
