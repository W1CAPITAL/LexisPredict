'use server';

/**
 * Radar NUMOPEDE — cruza advogados_banca (nome+OAB) com processos.advogado (apelidos/combos).
 */
import {
  getUserContext,
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  listAdvogadosBanca,
} from '@/lib/server-db';
import {
  scanTextForPredatoria,
  scorePredatoria,
  normalizeLawyerKey,
  hasNumopedeSignal,
  type PredatoriaRisk,
  type PredatoriaSignal,
} from '@/lib/predatoria-radar';
import {
  caseMatchesBancaAdv,
  oabNumbersFromBanca,
  type BancaAdv,
} from '@/lib/advogado-match';
import { buildCnaSearchUrl, normalizeOabNumero, isValidOabUf } from '@/lib/oab-consulta';
import { consultarOabAction } from '@/app/actions/oab-actions';
import type { LegalCase } from '@/lib/case-logic';

export type PredatoriaHitCase = {
  protocolo: string;
  cliente: string;
  advogado: string;
  bancaNome?: string;
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

export type AdvogadoBancaRadar = {
  id: string;
  nome: string;
  key: string;
  totalProcessos: number;
  oabUf?: string;
  oabNumero?: string;
  oabLabel?: string;
  aliases: string[];
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
    c.advogado,
    ...(Array.isArray(c.movimentos)
      ? c.movimentos.map((m: any) => [m.nome, m.complemento, m.descricao].filter(Boolean).join(' '))
      : []),
  ];
  return parts.filter(Boolean).map(String).join('\n');
}

function caseHasNumopedeFlag(c: any): boolean {
  return !!(c.sinal_numopede || c.sinal_predatoria || c.dados?.sinal_numopede || c.dados?.sinal_predatoria);
}

function pickOabLabel(a: BancaAdv): { uf?: string; numero?: string; label?: string } {
  const raw = [a.oab, a.numero_oab, a.oabs].filter(Boolean).join(' | ');
  const nums = oabNumbersFromBanca(a);
  const m = String(raw).match(/\b([A-Z]{2})\s*[\/\s-]*\s*([\d.]+)/i);
  const uf = (a.oab_uf || m?.[1] || '').toUpperCase() || undefined;
  const numero = nums[0];
  return { uf, numero, label: raw || (numero ? `${uf || ''}/${numero}` : undefined) };
}

export async function listarAdvogadosBancaAction(): Promise<{
  success: boolean;
  advogados: AdvogadoBancaRadar[];
  orfaos: Array<{ label: string; total: number }>;
  error?: string;
}> {
  const { empresa_id } = await getUserContext();
  if (!empresa_id) return { success: false, advogados: [], orfaos: [], error: 'Sessão expirada' };

  const [bancaRaw, cases] = await Promise.all([
    listAdvogadosBanca(),
    getStoredCasesForEmpresa(empresa_id, true),
  ]);
  const banca = (bancaRaw || []) as BancaAdv[];

  const rows: AdvogadoBancaRadar[] = banca.map((a) => {
    const o = pickOabLabel(a);
    return {
      id: String(a.id || normalizeLawyerKey(a.nome || '')),
      nome: String(a.nome || 'Sem nome'),
      key: normalizeLawyerKey(a.nome || '') || String(a.id),
      totalProcessos: 0,
      oabUf: o.uf,
      oabNumero: o.numero,
      oabLabel: o.label,
      aliases: [],
      numopedeHits: 0,
    };
  });

  const aliasCount = new Map<string, Map<string, number>>();
  const orphan = new Map<string, number>();

  for (const c of cases || []) {
    const field = String((c as any).advogado || '').trim();
    if (!field || /n[aã]o\s*atribu/i.test(field)) continue;
    const text = collectCaseText(c);
    const sigs = scanTextForPredatoria(text);
    const temN = hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c);

    let matched = false;
    for (const row of rows) {
      const src = banca.find((b) => String(b.id) === row.id) || { nome: row.nome, oab: row.oabLabel };
      if (caseMatchesBancaAdv(field, src as BancaAdv, text)) {
        matched = true;
        row.totalProcessos += 1;
        if (temN) row.numopedeHits += 1;
        if (!aliasCount.has(row.key)) aliasCount.set(row.key, new Map());
        const am = aliasCount.get(row.key)!;
        am.set(field, (am.get(field) || 0) + 1);
      }
    }
    if (!matched) orphan.set(field, (orphan.get(field) || 0) + 1);
  }

  for (const row of rows) {
    const am = aliasCount.get(row.key);
    if (am) {
      row.aliases = Array.from(am.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, n]) => (n > 1 ? `${label} (${n})` : label));
    }
  }

  rows.sort((a, b) => {
    if (b.numopedeHits !== a.numopedeHits) return b.numopedeHits - a.numopedeHits;
    return b.totalProcessos - a.totalProcessos;
  });

  const orfaos = Array.from(orphan.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 40);

  return { success: true, advogados: rows, orfaos };
}

export async function analisarAdvogadoPredatoriaAction(input: {
  nome?: string;
  oabUf?: string;
  oabNumero?: string;
  bancaId?: string;
}): Promise<PredatoriaReport> {
  const disclaimer =
    'Cruza advogados_banca com o campo advogado dos processos. Só alerta NUMOPEDE/predatória nos textos capturados.';

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
      error: (o as any)?.error,
    };
  }

  const banca = ((await listAdvogadosBanca()) || []) as BancaAdv[];
  let target: BancaAdv | null = null;
  if (input.bancaId) target = banca.find((b) => String(b.id) === String(input.bancaId)) || null;
  if (!target && nomeQ) {
    const k = normalizeLawyerKey(nomeQ);
    target =
      banca.find((b) => normalizeLawyerKey(b.nome || '') === k) ||
      banca.find((b) => {
        const bn = normalizeLawyerKey(b.nome || '');
        return bn.includes(k) || k.includes(bn) || caseMatchesBancaAdv(nomeQ, b);
      }) ||
      null;
  }
  if (!target && oabNumero) {
    target = banca.find((b) => oabNumbersFromBanca(b).includes(oabNumero)) || null;
  }
  if (!target && (nomeQ || oabNumero)) {
    target = { nome: nomeQ || oabBlock?.nome, oab: oabNumero ? `${oabUf}/${oabNumero}` : undefined, numero_oab: oabNumero };
  }

  const cases = await getStoredCasesForEmpresa(empresa_id, true);
  const hits: PredatoriaHitCase[] = [];
  const allSignals: PredatoriaSignal[] = [];

  for (const c of cases || []) {
    const field = String((c as any).advogado || '');
    const text = collectCaseText(c);
    if (target && !caseMatchesBancaAdv(field, target, text)) continue;

    const sigs = scanTextForPredatoria(text);
    const temN = hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c);
    if (!temN) continue;

    hits.push({
      protocolo: String((c as any).protocolo || ''),
      cliente: String((c as any).cliente || ''),
      advogado: field,
      bancaNome: target?.nome,
      tribunal: String((c as any).tribunal || ''),
      signals: sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE', weight: 25 }],
      temNumopede: true,
    });
    allSignals.push(...(sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE', weight: 25 }]));
  }

  const byCode = new Map<string, PredatoriaSignal>();
  for (const s of allSignals) {
    const prev = byCode.get(s.code);
    if (!prev || s.weight >= prev.weight) byCode.set(s.code, s);
  }

  return {
    success: true,
    query: { nome: target?.nome || nomeQ, oabUf: oabUf || undefined, oabNumero: oabNumero || undefined },
    oab: oabBlock,
    casesMatched: hits.length,
    risk: scorePredatoria(Array.from(byCode.values()), { volumeCases: hits.length }),
    hits: hits.slice(0, 120),
    disclaimer,
  };
}

export async function escanearBancaNumopedeAction(input?: {
  lawyerKeys?: string[];
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
    'Varredura pela banca cadastrada cruzada com processos.advogado. Só NUMOPEDE/predatória textual.';

  const { empresa_id } = await getUserContext();
  if (!empresa_id) {
    return { success: false, scannedLawyers: 0, hits: [], flagged: 0, byLawyer: [], disclaimer, error: 'Sessão' };
  }

  const banca = ((await listAdvogadosBanca()) || []) as BancaAdv[];
  const keys = (input?.lawyerKeys || []).map(String);
  const selected =
    keys.length === 0
      ? banca
      : banca.filter(
          (b) =>
            keys.includes(String(b.id)) ||
            keys.includes(normalizeLawyerKey(b.nome || '')) ||
            keys.some((k) => {
              const bn = normalizeLawyerKey(b.nome || '');
              return bn.includes(k) || k.includes(bn);
            })
        );

  const cases = (await getStoredCasesForEmpresa(empresa_id, true)) as LegalCase[];
  const hits: PredatoriaHitCase[] = [];
  const lawyerHitCount = new Map<string, { nome: string; hits: number }>();
  const flagProtocols = new Set<string>();

  for (const c of cases || []) {
    const field = String((c as any).advogado || '');
    const text = collectCaseText(c);
    const sigs = scanTextForPredatoria(text);
    const temN = hasNumopedeSignal(sigs) || caseHasNumopedeFlag(c);
    if (!temN) continue;

    const matched = selected.filter((b) => caseMatchesBancaAdv(field, b, text));
    if (selected.length && matched.length === 0) {
      if (keys.length === 0) {
        hits.push({
          protocolo: String((c as any).protocolo || ''),
          cliente: String((c as any).cliente || ''),
          advogado: field,
          bancaNome: '(não mapeado na banca)',
          tribunal: String((c as any).tribunal || ''),
          signals: sigs,
          temNumopede: true,
        });
        flagProtocols.add(String((c as any).protocolo || ''));
        const prev = lawyerHitCount.get('_orfao') || { nome: '(sem match na banca)', hits: 0 };
        prev.hits += 1;
        lawyerHitCount.set('_orfao', prev);
      }
      continue;
    }

    const use = matched.length ? matched : [];
    for (const b of use) {
      hits.push({
        protocolo: String((c as any).protocolo || ''),
        cliente: String((c as any).cliente || ''),
        advogado: field,
        bancaNome: b.nome,
        tribunal: String((c as any).tribunal || ''),
        signals: sigs.length ? sigs : [{ code: 'NUMOPEDE', label: 'Flag NUMOPEDE', weight: 25 }],
        temNumopede: true,
      });
      const k = normalizeLawyerKey(b.nome || '') || String(b.id);
      const prev = lawyerHitCount.get(k) || { nome: String(b.nome || field), hits: 0 };
      prev.hits += 1;
      lawyerHitCount.set(k, prev);
    }
    flagProtocols.add(String((c as any).protocolo || ''));
  }

  const seen = new Set<string>();
  const uniqueHits = hits.filter((h) => {
    if (seen.has(h.protocolo)) return false;
    seen.add(h.protocolo);
    return true;
  });

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
    await saveStoredCasesForEmpresa(updated, empresa_id, true);
  }

  return {
    success: true,
    scannedLawyers: selected.length || banca.length,
    hits: uniqueHits.slice(0, 200),
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
    disclaimer: 'Análise só do texto colado.',
  };
}

/**
 * Varredura PROFUNDA: consulta DataJud + DJEN de verdade (lento, 1 CNJ por vez).
 * Use em lotes (limit 20–50) para não estourar timeout da Vercel (~60s).
 */
export async function escanearBancaNumopedeProfundoAction(input?: {
  lawyerKeys?: string[];
  limit?: number;
  offset?: number;
  aplicarFlags?: boolean;
  delayMs?: number;
}): Promise<{
  success: boolean;
  scanned: number;
  remaining: number;
  hits: PredatoriaHitCase[];
  flagged: number;
  byLawyer: Array<{ nome: string; hits: number }>;
  errors: number;
  logs: string[];
  nextOffset: number;
  disclaimer: string;
  error?: string;
}> {
  const disclaimer =
    'Varredura profunda: DataJud + DJEN por CNJ. Rápida = só texto já no banco. Use lotes (ex. 25) e repita com offset.';

  const { empresa_id } = await getUserContext();
  if (!empresa_id) {
    return {
      success: false,
      scanned: 0,
      remaining: 0,
      hits: [],
      flagged: 0,
      byLawyer: [],
      errors: 0,
      logs: [],
      nextOffset: 0,
      disclaimer,
      error: 'Sessão',
    };
  }

  const limit = Math.min(Math.max(input?.limit ?? 25, 1), 40);
  const offset = Math.max(input?.offset ?? 0, 0);
  const delayMs = Math.min(Math.max(input?.delayMs ?? 400, 0), 2000);

  const banca = ((await listAdvogadosBanca()) || []) as BancaAdv[];
  const keys = (input?.lawyerKeys || []).map(String);
  const selected =
    keys.length === 0
      ? banca
      : banca.filter(
          (b) =>
            keys.includes(String(b.id)) ||
            keys.includes(normalizeLawyerKey(b.nome || '')) ||
            keys.some((k) => {
              const bn = normalizeLawyerKey(b.nome || '');
              return bn.includes(k) || k.includes(bn);
            })
        );

  const cases = (await getStoredCasesForEmpresa(empresa_id, true)) as LegalCase[];

  // Fila: processos que batem com a banca selecionada (ou todos se banca vazia)
  const queue: LegalCase[] = [];
  for (const c of cases || []) {
    const field = String((c as any).advogado || '');
    if (selected.length === 0) {
      queue.push(c);
      continue;
    }
    const ok = selected.some((b) => caseMatchesBancaAdv(field, b, field));
    if (ok) queue.push(c);
  }

  const slice = queue.slice(offset, offset + limit);
  const remaining = Math.max(0, queue.length - offset - slice.length);

  const { scanSingleCaseAction } = await import('@/app/actions/case-actions');

  const hits: PredatoriaHitCase[] = [];
  const lawyerHitCount = new Map<string, { nome: string; hits: number }>();
  const flagProtocols = new Set<string>();
  const logs: string[] = [];
  let errors = 0;
  let scanned = 0;

  for (const c of slice) {
    const proto = String((c as any).protocolo || '').trim();
    if (!proto) continue;
    scanned++;
    try {
      const res: any = await scanSingleCaseAction(proto, {
        mode: 'both',
        fast: false,
      });
      const mov = Array.isArray(res?.movimentos) ? res.movimentos : [];
      const com = Array.isArray(res?.comunicacoes) ? res.comunicacoes : [];
      const textParts = [
        collectCaseText(c),
        ...mov.map((m: any) => [m.nome, m.complemento, m.descricao].filter(Boolean).join(' ')),
        ...com.map((x: any) => String(x.texto || x.tipoDocumento || '')),
        res?.datajud_ultimo_nome,
        res?.djen_ultimo_resumo,
        res?.evento_resumo,
      ];
      const text = textParts.filter(Boolean).join('\n');
      const sigs = scanTextForPredatoria(text);
      const temN = hasNumopedeSignal(sigs);

      logs.push(
        temN
          ? `[NUMOPEDE] ${proto} — ${sigs.map((s) => s.code).join(',')}`
          : `[ok] ${proto} — sem NUMOPEDE (${mov.length} mov / ${com.length} djen)`
      );

      if (temN) {
        const field = String((c as any).advogado || '');
        const matched = selected.filter((b) => caseMatchesBancaAdv(field, b, text));
        const b0 = matched[0];
        hits.push({
          protocolo: proto,
          cliente: String((c as any).cliente || ''),
          advogado: field,
          bancaNome: b0?.nome,
          tribunal: String((c as any).tribunal || ''),
          signals: sigs,
          temNumopede: true,
        });
        flagProtocols.add(proto);
        const k = normalizeLawyerKey(b0?.nome || field) || '_';
        const prev = lawyerHitCount.get(k) || { nome: String(b0?.nome || field || proto), hits: 0 };
        prev.hits += 1;
        lawyerHitCount.set(k, prev);
      }
    } catch (e: any) {
      errors++;
      logs.push(`[erro] ${proto} — ${e?.message || 'falha'}`);
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  let flagged = 0;
  if (input?.aplicarFlags && flagProtocols.size) {
    // Recarrega carteira (scan já persistiu movimentos; só flags)
    const fresh = (await getStoredCasesForEmpresa(empresa_id, true)) as LegalCase[];
    const updated = fresh.map((c) => {
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
    await saveStoredCasesForEmpresa(updated, empresa_id, true);
  }

  return {
    success: true,
    scanned,
    remaining,
    hits,
    flagged,
    byLawyer: Array.from(lawyerHitCount.values()).sort((a, b) => b.hits - a.hits),
    errors,
    logs: logs.slice(-80),
    nextOffset: offset + scanned,
    disclaimer,
  };
}
