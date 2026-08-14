
'use server';

/**
 * Radar predatória — banca de advogados da carteira + NUMOPEDE.
 * Só alerta com menção real a NUMOPEDE / litigância predatória nos textos já capturados.
 */
import { getUserContext, getStoredCasesForEmpresa, saveStoredCasesForEmpresa } from '@/lib/server-db';
import {
  scanTextForPredatoria,
  scorePredatoria,
  normalizeLawyerKey,
  hasNumopedeSignal,
  isNumopedeOnly,
  extractOabFromText,
  type PredatoriaRisk,
  type PredatoriaSignal,
} from '@/lib/predatoria-radar';
import { buildCnaSearchUrl, normalizeOabNumero, isValidOabUf } from '@/lib/oab-consulta';
import { consultarOabAction } from '@/app/actions/oab-actions';
import type { LegalCase } from '@/lib/case-logic';

export type PredatoriaHitCase = {
  protocolo: string;
  cliente: string;
  advogado: string;
  tribunal?: string;
  signals: PredatoriaSignal[];
  temNumopede: boolean;
};

export type PredatoriaReport = {
  success: boolean;
  query: { nome?: string; oabUf?: string; oabNumero?: string };
  oab?: { nome?: string; situacao?: string; consultaUrl: string; error?: string };
  casesMatched: number;
  risk: PredatoriaRisk;
  hits: PredatoriaHitCase[];
  disclaimer: string;
  error?: string;
};

export type AdvogadoBanca = {
  nome: string;
  key: string;
  totalProcessos: number;
  oabUf?: string;
  oabNumero?: string;
  numopedeHits: number;
};

function collectCaseText(c: any): string {
  const parts = [
    c.datajud_ultimo_nome,
    c.datajud_encerrado_motivo,
    c.djen_ultimo_resumo,
    c.evento_resumo,
    c.evento_tipo,
    c.observacao,
    c.observacoes,
    c.busca_apreensao_motivo,
    c.cumprimento_sentenca_motivo,
    (c as any).dados?.datajud_ultimo_nome,
    (c as any).dados?.djen_ultimo_resumo,
    ...(Array.isArray(c.movimentos)
      ? c.movimentos.map((m: any) => [m.nome, m.complemento, m.descricao].filter(Boolean).join(' '))
      : []),
  ];
  return parts.filter(Boolean).map(String).join('\n');
}

function caseHasNumopedeFlag(c: any): boolean {
  return !!(
    c.sinal_numopede ||
    c.sinal_predatoria ||
    (c as any).dados?.sinal_numopede ||
    (c as any).dados?.sinal_predatoria
  );
}

/** Lista advogados únicos da carteira (com contagem e OAB se houver no texto/cadastro). */
export async function listarAdvogadosBancaAction(): Promise<{
  success: boolean;
  advogados: AdvogadoBanca[];
  error?: string;
}> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, advogados: [], error: 'Sessão expirada' };

  const cases = await getStoredCasesForEmpresa(empresa_id);
  const map = new Map<string, AdvogadoBanca>();

  for (const c of cases || []) {
    const nome = String((c as any).advogado || '').trim();
    if (!nome || nome === '-' || /n[aã]o\s*atribu/i.test(nome)) continue;
    const key = normalizeLawyerKey(nome);
    if (key.length < 3) continue;

    let row = map.get(key);
    if (!row) {
      const oabFrom =
        extractOabFromText(nome) ||
        extractOabFromText(String((c as any).oab || '')) ||
        extractOabFromText(collectCaseText(c));
      row = {
        nome,
        key,
        totalProcessos: 0,
        oabUf: oabFrom?.uf,
        oabNumero: oabFrom?.numero,
        numopedeHits: 0,
      };
      map.set(key, row);
    }
    row.totalProcessos += 1;

    const sigs = scanTextForPredatoria(collectCaseText(c));
    if (hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c)) {
      row.numopedeHits += 1;
    }
    if (!row.oabNumero) {
      const o2 = extractOabFromText(nome) || extractOabFromText(String((c as any).oab || ''));
      if (o2?.numero) {
        row.oabUf = o2.uf;
        row.oabNumero = o2.numero;
      }
    }
  }

  const advogados = Array.from(map.values()).sort((a, b) => {
    if (b.numopedeHits !== a.numopedeHits) return b.numopedeHits - a.numopedeHits;
    return b.totalProcessos - a.totalProcessos;
  });

  return { success: true, advogados };
}

export async function analisarAdvogadoPredatoriaAction(input: {
  nome?: string;
  oabUf?: string;
  oabNumero?: string;
}): Promise<PredatoriaReport> {
  const disclaimer =
    'Processos disciplinares da OAB em curso são sigilosos. Este radar só usa sinais da SUA carteira e textos públicos já capturados (DataJud/DJEN). Não afirma que existe investigação oficial.';

  const { empresa_id } = await getUserContext();
  if (!empresa_id) {
    return {
      success: false,
      query: input,
      casesMatched: 0,
      risk: { score: 0, band: 'baixo', signals: [], summary: 'Sessão expirada' },
      hits: [],
      disclaimer,
      error: 'Sessão expirada',
    };
  }

  const nomeQ = String(input.nome || '').trim();
  const oabUf = String(input.oabUf || '').toUpperCase();
  const oabNumero = normalizeOabNumero(input.oabNumero || '');

  let oabBlock: PredatoriaReport['oab'] | undefined;
  if (oabUf && oabNumero && isValidOabUf(oabUf)) {
    const o = await consultarOabAction(oabUf, oabNumero);
    oabBlock = {
      nome: (o as any)?.nome,
      situacao: (o as any)?.situacao,
      consultaUrl: buildCnaSearchUrl(oabUf, oabNumero),
      error: (o as any)?.error || (o as any)?.success === false ? (o as any)?.error : undefined,
    };
  } else if (oabUf && oabNumero) {
    oabBlock = { consultaUrl: buildCnaSearchUrl(oabUf, oabNumero) };
  }

  const cases = await getStoredCasesForEmpresa(empresa_id);
  const keyNome = normalizeLawyerKey(nomeQ || oabBlock?.nome || '');
  const hits: PredatoriaHitCase[] = [];
  const allSignals: PredatoriaSignal[] = [];

  for (const c of cases || []) {
    const adv = String((c as any).advogado || '');
    const advKey = normalizeLawyerKey(adv);
    const matchNome =
      !keyNome ||
      (keyNome.length >= 3 &&
        (advKey.includes(keyNome) ||
          keyNome.includes(advKey) ||
          advKey.split(' ').some((p) => p.length > 3 && keyNome.includes(p))));

    if (keyNome && !matchNome) continue;

    const text = collectCaseText(c);
    const sigs = scanTextForPredatoria(text);
    const temN = hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c);

    // Alerta só com NUMOPEDE / predatória textual — volume sem keyword não apita
    if (temN) {
      hits.push({
        protocolo: String((c as any).protocolo || ''),
        cliente: String((c as any).cliente || ''),
        advogado: adv,
        tribunal: String((c as any).tribunal || ''),
        signals: sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE já gravada', weight: 25 }],
        temNumopede: true,
      });
      allSignals.push(...(sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE', weight: 25 }]));
    }
  }

  const byCode = new Map<string, PredatoriaSignal>();
  for (const s of allSignals) {
    const prev = byCode.get(s.code);
    if (!prev || s.weight >= prev.weight) byCode.set(s.code, s);
  }

  const risk = scorePredatoria(Array.from(byCode.values()), { volumeCases: hits.length });

  return {
    success: true,
    query: { nome: nomeQ || oabBlock?.nome, oabUf: oabUf || undefined, oabNumero: oabNumero || undefined },
    oab: oabBlock,
    casesMatched: hits.length,
    risk,
    hits: hits.slice(0, 120),
    disclaimer,
  };
}

/**
 * Varre a banca inteira (ou lista de keys) e retorna só processos com NUMOPEDE/predatória.
 * Opcionalmente grava flags no banco.
 */
export async function escanearBancaNumopedeAction(input?: {
  lawyerKeys?: string[]; // vazio = todos
  aplicarFlags?: boolean;
}): Promise<{
  success: boolean;
  scannedLawyers: number;
  hits: PredatoriaHitCase[];
  flagged: number;
  byLawyer: Array<{ nome: string; hits: number }>;
  disclaimer: string;
  error?: string;
}> {
  const disclaimer =
    'Só processos com menção NUMOPEDE / litigância predatória nos textos da carteira. Não confirma investigação OAB.';

  const { empresa_id } = await getUserContext();
  if (!empresa_id) {
    return { success: false, scannedLawyers: 0, hits: [], flagged: 0, byLawyer: [], disclaimer, error: 'Sessão' };
  }

  const cases = (await getStoredCasesForEmpresa(empresa_id)) as LegalCase[];
  const keysFilter = (input?.lawyerKeys || []).map(normalizeLawyerKey).filter(Boolean);
  const hits: PredatoriaHitCase[] = [];
  const lawyerHitCount = new Map<string, { nome: string; hits: number }>();
  const flagProtocols = new Set<string>();

  for (const c of cases || []) {
    const adv = String((c as any).advogado || '').trim();
    const advKey = normalizeLawyerKey(adv);
    if (keysFilter.length && !keysFilter.some((k) => advKey.includes(k) || k.includes(advKey))) continue;

    const text = collectCaseText(c);
    const sigs = scanTextForPredatoria(text);
    const temN = hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c);
    if (!temN) continue;

    const proto = String((c as any).protocolo || '');
    hits.push({
      protocolo: proto,
      cliente: String((c as any).cliente || ''),
      advogado: adv,
      tribunal: String((c as any).tribunal || ''),
      signals: sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE', weight: 25 }],
      temNumopede: true,
    });
    flagProtocols.add(proto);

    const prev = lawyerHitCount.get(advKey) || { nome: adv || 'Sem advogado', hits: 0 };
    prev.hits += 1;
    lawyerHitCount.set(advKey, prev);
  }

  let flagged = 0;
  if (input?.aplicarFlags && flagProtocols.size) {
    const updated = cases.map((c) => {
      const proto = String((c as any).protocolo || '');
      if (!flagProtocols.has(proto)) return c;
      flagged++;
      return {
        ...c,
        sinal_numopede: true,
        sinal_predatoria: true,
        predatoria_marcado_em: new Date().toISOString(),
      } as LegalCase;
    });
    await saveStoredCasesForEmpresa(updated, empresa_id);
  }

  const scanned =
    keysFilter.length ||
    new Set(
      (cases || [])
        .map((c) => normalizeLawyerKey(String((c as any).advogado || '')))
        .filter((k) => k.length >= 3)
    ).size;

  return {
    success: true,
    scannedLawyers: typeof scanned === 'number' ? scanned : 0,
    hits: hits.slice(0, 200),
    flagged,
    byLawyer: Array.from(lawyerHitCount.values()).sort((a, b) => b.hits - a.hits),
    disclaimer,
  };
}

export async function analisarTextoPredatoriaAction(texto: string): Promise<{
  success: boolean;
  risk: PredatoriaRisk;
  disclaimer: string;
}> {
  const signals = scanTextForPredatoria(texto);
  return {
    success: true,
    risk: scorePredatoria(signals),
    disclaimer: 'Análise só do texto colado. Não consulta OAB nem confirma investigação oficial.',
  };
}
