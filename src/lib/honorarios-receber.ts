/**
 * Motor Lote 7 — Honorários a receber (sucumbência a favor do autor / banca).
 * Heurística sobre teor DataJud/DJEN. Não inventa valor em R$.
 *
 * Hierarquia:
 * 1) BLOQUEIO (recíproca / a cargo do autor / improcedência)
 * 2) FORTE (condenação explícita do réu a pagar honorários)
 * 3) MÉDIO (fixação %, tabela OAB, art. 85 CPC)
 * 4) FRACO (só "sucumbência" genérica sem destinatário)
 */

export type HonorariosReceberNivel = 'nenhum' | 'fraco' | 'medio' | 'forte' | 'bloqueado';

export type HonorariosReceberResult = {
  /** Há indício de honorários cobráveis a favor do polo ativo / advogado */
  temHonorariosAReceber: boolean;
  nivel: HonorariosReceberNivel;
  confianca: number; // 0–100
  percentual: number | null;
  valorTexto: string | null; // R$ citado perto de honorários (referência)
  motivos: string[];
  bloqueios: string[];
  trechos: string[]; // snippets curtos para UI
};

function limpar(t: string): string {
  return String(t || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trechos de ±80 chars em torno do match */
function trechosEm(text: string, re: RegExp, max = 3): string[] {
  const out: string[] = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null && out.length < max) {
    const i = m.index;
    out.push(text.slice(Math.max(0, i - 40), Math.min(text.length, i + (m[0].length + 40))).trim());
  }
  return out;
}

// --- BLOQUEIOS (não há honorários a receber para a banca do autor) ---
const BLOQUEIO = [
  /sucumb[eê]ncia\s+rec[ií]proca/i,
  /reciprocamente\s+(?:as\s+partes\s+)?(?:arcar|pagar|responder)/i,
  /cada\s+(?:uma\s+das\s+)?partes\s+arcar/i,
  /cada\s+parte\s+arcar[aá]?\s+com\s+(?:os\s+)?s[eu]us?\s+honor/i,
  /honor[aá]rios\s+(?:advocat[ií]cios\s+)?a\s+cargo\s+d[oa]\s+autor/i,
  /autor\s+arcar[aá]?\s+com\s+(?:os\s+)?honor/i,
  /autor\s+sucumbiu/i,
  /sucumbente\s+o\s+autor/i,
  /compensa[cç][aã]o\s+de\s+honor[aá]rios/i,
  /improced[eê]ncia\s+total.{0,80}honor[aá]rios.{0,40}autor/i,
  /julgo\s+improcedente.{0,120}honor[aá]rios.{0,40}autor/i,
  /isento\s+de\s+honor[aá]rios/i,
  /sem\s+condena[cç][aã]o\s+em\s+honor[aá]rios/i,
  /deixo\s+de\s+condenar\s+em\s+honor[aá]rios/i,
  /honor[aá]rios\s+indevidos/i,
  // Lote 3 — cliente/autor paga (NÃO é hon. a receber da banca do autor)
  /(?:cliente|autor|requerente)\s+(?:dever[aá]|deve|ficar[aá]\s+obrigad[oa])\s+(?:a\s+)?pagar\s+(?:os\s+)?honor/i,
  /honor[aá]rios.{0,40}(?:pagos?\s+pel[oa]\s+autor|a\s+cargo\s+d[oa]\s+(?:cliente|requerente))/i,
  /autor\s+(?:pagar[aá]|arcar[aá])\s+.{0,30}10\s*%/i,
  /condeno\s+o\s+autor\s+.{0,50}honor/i,
  /condena[cç][aã]o\s+d[oa]\s+autor\s+em\s+honor/i,
  /parte\s+autora\s+(?:arcar|pagar|responder).{0,40}honor/i,
  /sucumb[eê]ncia\s+(?:a\s+cargo\s+)?d[ao]\s+(?:autor|requerente)/i,
  /(?:autor|cliente)\s+pagar[aá]\s+10\s*%\s+(?:ao\s+)?(?:advogado|patrono)/i,
];

// --- FORTE: réu/banco condenado a pagar honorários ---
const FORTE = [
  /condeno\s+o\s+r[eé]u\s+.{0,60}honor[aá]rios/i,
  /condenado\s+o\s+r[eé]u\s+.{0,40}honor[aá]rios/i,
  /conden[oa]\s+(?:a\s+)?(?:parte\s+)?r[eé]\s+.{0,50}honor[aá]rios/i,
  /r[eé]u\s+a\s+pagar\s+honor[aá]rios/i,
  /r[eé]u\s+arcar[aá]?\s+com\s+(?:os\s+)?honor[aá]rios/i,
  /honor[aá]rios\s+(?:advocat[ií]cios\s+)?a\s+cargo\s+d[oa]\s+r[eé]u/i,
  /honor[aá]rios\s+(?:advocat[ií]cios\s+)?pelo\s+r[eé]u/i,
  /honor[aá]rios\s+(?:advocat[ií]cios\s+)?(?:a\s+serem\s+)?pagos?\s+pel[oa]\s+r[eé]u/i,
  /sucumb[eê]ncia\s+a\s+cargo\s+d[oa]\s+r[eé]u/i,
  /sucumb[eê]ncia\s+do\s+r[eé]u/i,
  /r[eé]u\s+sucumbente/i,
  /banco\s+.{0,30}(?:arcar|pagar|condenad).{0,40}honor/i,
  /institui[cç][aã]o\s+financeira.{0,40}honor[aá]rios/i,
  /pagar\s+ao\s+autor\s+(?:os\s+)?honor[aá]rios/i,
  /pagar\s+aos?\s+advogados?\s+d[oa]\s+autor/i,
  /honor[aá]rios\s+em\s+favor\s+d[oa]\s+(?:autor|patrono|advogado)/i,
  /honor[aá]rios\s+(?:advocat[ií]cios\s+)?em\s+favor\s+d[oa]\s+parte\s+autora/i,
  /arbitro\s+os\s+honor[aá]rios.{0,50}(?:r[eé]u|10\s*%|tabela)/i,
  /fixo\s+(?:os\s+)?honor[aá]rios.{0,50}(?:r[eé]u|10\s*%|sobre)/i,
  /condeno\s+.{0,20}ao\s+pagamento\s+de\s+honor[aá]rios/i,
  /art\.?\s*85.{0,60}honor[aá]rios/i,
  /honor[aá]rios\s+advocat[ií]cios\s+de\s+10\s*%/i,
  /honor[aá]rios\s+de\s+10\s*%\s+sobre/i,
  /honor[aá]rios\s+advocat[ií]cios\s+no\s+patamar\s+de\s+\d{1,2}\s*%/i,
  /conden[oa]\s+.{0,40}honor[aá]rios\s+advocat[ií]cios\s+de\s+\d{1,2}\s*%/i,
  /r[eé]u\s+responder[aá]\s+pelos?\s+honor[aá]rios/i,
  /parte\s+r[eé]\s+arcar[aá]?\s+com\s+(?:as\s+)?custas\s+e\s+honor/i,
];

// --- MÉDIO: fixação sem destinatário explícito, mas contexto procedente ---
const MEDIO = [
  /arbitro\s+os\s+honor[aá]rios\s+advocat[ií]cios/i,
  /fixo\s+os\s+honor[aá]rios\s+advocat[ií]cios/i,
  /honor[aá]rios\s+advocat[ií]cios\s+em\s+\d/i,
  /honor[aá]rios\s+pela\s+tabela\s+da\s+oab/i,
  /tabela\s+de\s+honor[aá]rios\s+da\s+oab/i,
  /percentual\s+de\s+\d{1,2}\s*%\s+.{0,20}honor/i,
  /verba\s+honor[aá]ria/i,
  /verba\s+de\s+sucumb[eê]ncia/i,
  /condena[cç][aã]o\s+em\s+honor[aá]rios\s+advocat/i,
  /custas\s+processuais\s+e\s+honor[aá]rios/i,
  /honor[aá]rios\s+advocat[ií]cios\s+fixados?\s+em/i,
  /fixados?\s+os\s+honor[aá]rios\s+em\s+\d{1,2}\s*%/i,
  /com\s+base\s+no\s+art\.?\s*85\s+do\s+cpc/i,
  /aplica[cç][aã]o\s+do\s+art\.?\s*85/i,
  /sucumb[eê]ncia\s+da\s+parte\s+r[eé]/i,
];

// --- FRACO: só menção genérica ---
const FRACO = [
  /honor[aá]rios\s+advocat[ií]cios/i,
  /sucumb[eê]ncia/i,
  /honor[aá]rios\s+de\s+sucumb/i,
];

const RE_PCT =
  /honor[aá]rios(?:\s+advocat[ií]cios)?[^.%]{0,50}?(\d{1,2}(?:[.,]\d+)?)\s*%/gi;

const RE_VALOR_NEAR =
  /honor[aá]rios[^.]{0,60}R\$\s*([\d.]+(?:,\d{2})?)|R\$\s*([\d.]+(?:,\d{2})?)[^.]{0,40}honor[aá]rios/gi;

export function analisarHonorariosAReceber(
  blob: string | null | undefined,
  opts?: { isProcedente?: boolean; meritoTipo?: string | null }
): HonorariosReceberResult {
  const text = limpar(blob || '');
  const motivos: string[] = [];
  const bloqueios: string[] = [];
  const trechos: string[] = [];

  if (text.length < 40) {
    return {
      temHonorariosAReceber: false,
      nivel: 'nenhum',
      confianca: 0,
      percentual: null,
      valorTexto: null,
      motivos: ['teor insuficiente para analisar honorários'],
      bloqueios: [],
      trechos: [],
    };
  }

  for (const re of BLOQUEIO) {
    if (re.test(text)) {
      bloqueios.push(re.source.slice(0, 48));
      trechos.push(...trechosEm(text, re, 1));
    }
  }
  if (bloqueios.length) {
    return {
      temHonorariosAReceber: false,
      nivel: 'bloqueado',
      confianca: 85,
      percentual: null,
      valorTexto: null,
      motivos: ['bloqueio: honorários não cobráveis a favor do autor/banca'],
      bloqueios,
      trechos: trechos.slice(0, 3),
    };
  }

  let forte = 0;
  for (const re of FORTE) {
    if (re.test(text)) {
      forte += 1;
      motivos.push('padrão forte de sucumbência do réu');
      trechos.push(...trechosEm(text, re, 1));
    }
  }
  let medio = 0;
  for (const re of MEDIO) {
    if (re.test(text)) {
      medio += 1;
      motivos.push('fixação de honorários no dispositivo');
      trechos.push(...trechosEm(text, re, 1));
    }
  }
  let fraco = 0;
  for (const re of FRACO) {
    if (re.test(text)) {
      fraco += 1;
    }
  }

  let percentual: number | null = null;
  let m: RegExpExecArray | null;
  const reP = new RegExp(RE_PCT.source, 'gi');
  while ((m = reP.exec(text)) !== null) {
    const pct = parseFloat(String(m[1]).replace(',', '.'));
    if (!Number.isNaN(pct) && pct > 0 && pct <= 30) {
      percentual = pct;
      motivos.push(`percentual de honorários ~${pct}%`);
    }
  }

  let valorTexto: string | null = null;
  const reV = new RegExp(RE_VALOR_NEAR.source, 'gi');
  while ((m = reV.exec(text)) !== null) {
    valorTexto = m[1] || m[2] || null;
    if (valorTexto) motivos.push(`R$ citado junto a honorários (só referência)`);
  }

  // Procedência reforça médio→forte quando há fixação
  const procedente =
    opts?.isProcedente === true ||
    opts?.meritoTipo === 'procedente' ||
    opts?.meritoTipo === 'parcial' ||
    /julgo\s+procedente|parcialmente\s+procedente|dou\s+por\s+procedente/i.test(text);

  let nivel: HonorariosReceberNivel = 'nenhum';
  let confianca = 15;

  if (forte >= 1) {
    nivel = 'forte';
    confianca = 70 + Math.min(20, forte * 8);
    if (percentual != null) confianca += 5;
  } else if (medio >= 1 && procedente) {
    nivel = 'forte';
    confianca = 62 + Math.min(15, medio * 5);
    motivos.push('fixação + procedência → honorários a receber prováveis');
  } else if (medio >= 1) {
    nivel = 'medio';
    confianca = 48 + Math.min(12, medio * 4);
  } else if (fraco >= 1 && procedente) {
    nivel = 'fraco';
    confianca = 35;
    motivos.push('sucumbência genérica + procedência — enriquecer teor');
  } else if (fraco >= 1) {
    nivel = 'fraco';
    confianca = 22;
    motivos.push('menção genérica a honorários/sucumbência');
  }

  if (percentual != null && nivel === 'fraco') {
    nivel = 'medio';
    confianca = Math.max(confianca, 50);
  }
  if (percentual != null && nivel === 'medio') {
    confianca = Math.max(confianca, 58);
  }

  const temHonorariosAReceber =
    nivel === 'forte' || nivel === 'medio' || (nivel === 'fraco' && procedente && percentual != null);

  if (temHonorariosAReceber) {
    motivos.unshift(
      nivel === 'forte'
        ? 'HONORÁRIOS A RECEBER (sinal forte)'
        : nivel === 'medio'
          ? 'HONORÁRIOS A RECEBER (sinal médio — validar teor)'
          : 'possível honorários — confirmar no dispositivo'
    );
  }

  confianca = Math.max(0, Math.min(100, confianca));

  return {
    temHonorariosAReceber,
    nivel,
    confianca,
    percentual,
    valorTexto,
    motivos: [...new Set(motivos)].slice(0, 8),
    bloqueios,
    trechos: [...new Set(trechos)].slice(0, 4),
  };
}
