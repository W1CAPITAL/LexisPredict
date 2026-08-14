
'use server';

/**
 * Radar predatória — análise operacional (carteira + textos DataJud/DJEN).
 * Não substitui consulta sigilosa OAB/CNJ.
 */
import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import {
  scanTextForPredatoria,
  scorePredatoria,
  normalizeLawyerKey,
  type PredatoriaRisk,
  type PredatoriaSignal,
} from '@/lib/predatoria-radar';
import { buildCnaSearchUrl, normalizeOabNumero, isValidOabUf } from '@/lib/oab-consulta';
import { consultarOabAction } from '@/app/actions/oab-actions';

export type PredatoriaHitCase = {
  protocolo: string;
  cliente: string;
  advogado: string;
  tribunal?: string;
  signals: PredatoriaSignal[];
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
    ...(Array.isArray(c.movimentos)
      ? c.movimentos.map((m: any) => [m.nome, m.complemento, m.descricao].filter(Boolean).join(' '))
      : []),
  ];
  return parts.filter(Boolean).map(String).join('\n');
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
      nome: o.nome,
      situacao: o.situacao,
      consultaUrl: o.consultaUrl || buildCnaSearchUrl(oabUf, oabNumero),
      error: o.error,
    };
  } else if (oabUf || oabNumero) {
    oabBlock = {
      consultaUrl: oabUf && oabNumero ? buildCnaSearchUrl(oabUf, oabNumero) : 'https://cna.oab.org.br/',
      error: 'Informe UF e número OAB válidos para o link CNA.',
    };
  }

  const cases = await getStoredCasesForEmpresa(empresa_id);
  const keyNome = normalizeLawyerKey(nomeQ || oabBlock?.nome || '');
  const hits: PredatoriaHitCase[] = [];
  const allSignals: PredatoriaSignal[] = [];

  for (const c of cases || []) {
    const adv = String((c as any).advogado || '');
    const advKey = normalizeLawyerKey(adv);
    const matchNome =
      keyNome.length >= 4 &&
      (advKey.includes(keyNome) || keyNome.includes(advKey) || advKey.split(' ').some((p) => p.length > 3 && keyNome.includes(p)));
    // Sem nome: se só OAB, ainda assim podemos varrer menções na carteira toda (caro) — limitamos a quem tem advogado preenchido quando há nome
    if (keyNome && !matchNome) continue;

    const text = collectCaseText(c);
    const sigs = scanTextForPredatoria(text);
    if (sigs.length || (keyNome && matchNome)) {
      if (sigs.length) {
        hits.push({
          protocolo: String((c as any).protocolo || ''),
          cliente: String((c as any).cliente || ''),
          advogado: adv,
          tribunal: String((c as any).tribunal || ''),
          signals: sigs,
        });
        allSignals.push(...sigs);
      } else if (matchNome) {
        // processo do advogado sem keyword — conta volume
        hits.push({
          protocolo: String((c as any).protocolo || ''),
          cliente: String((c as any).cliente || ''),
          advogado: adv,
          tribunal: String((c as any).tribunal || ''),
          signals: [],
        });
      }
    }
  }

  // Dedup signals by code (keep max weight evidence)
  const byCode = new Map<string, PredatoriaSignal>();
  for (const s of allSignals) {
    const prev = byCode.get(s.code);
    if (!prev || s.weight >= prev.weight) byCode.set(s.code, s);
  }

  const volume = hits.length;
  const risk = scorePredatoria(Array.from(byCode.values()), { volumeCases: volume });

  return {
    success: true,
    query: { nome: nomeQ || oabBlock?.nome, oabUf: oabUf || undefined, oabNumero: oabNumero || undefined },
    oab: oabBlock,
    casesMatched: volume,
    risk,
    hits: hits.slice(0, 80),
    disclaimer,
  };
}

/** Analisa texto solto (ex.: colar despacho / DJEN) */
export async function analisarTextoPredatoriaAction(texto: string): Promise<{
  success: boolean;
  risk: PredatoriaRisk;
  disclaimer: string;
}> {
  const signals = scanTextForPredatoria(texto);
  return {
    success: true,
    risk: scorePredatoria(signals),
    disclaimer:
      'Análise só do texto colado. Não consulta OAB nem confirma investigação oficial.',
  };
}
