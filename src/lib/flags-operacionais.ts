/**
 * Flags operacionais unificadas (Dashboard + Tarefas + fila).
 * B.A. pode vir da carteira (indício no processo) OU dos hits da aba Busca e Apreensão.
 */
import type { LegalCase } from './case-logic';
import { resolveTemNovoAndamento } from './novidade';
import {
  hasAudienciaPosRetorno,
  isSentencaImprocedente,
  isSentencaProcedente,
} from './merito-detect';
import { detectarAudienciaPendente } from './audiencia-detect';

/** Protocolos com hit real na aba B.A. (ba_scan_logs / fila). */
export type BaHitIndex = Set<string>;

export function normalizeProtocolo(p: string | null | undefined): string {
  return String(p || '')
    .replace(/\D/g, '')
    .slice(0, 20);
}

export function temBaCarteira(c: LegalCase, baHits?: BaHitIndex): boolean {
  const proto = normalizeProtocolo(c.protocolo);
  // Hit real da aba/varredura B.A. (fonte confiável)
  if (baHits && proto && baHits.has(proto)) return true;
  // Tipo de evento já classificado como BA operacional
  if (c.evento_tipo === 'ba') return true;
  // ba_tipo explícito (ex.: mandado/liminar) — não basta indício solto
  if ((c as any).ba_tipo && String((c as any).ba_tipo).length > 1) return true;
  // Indício sozinho NÃO marca CRÍTICO: B.A. (evita falso positivo por jurisprudência)
  return false;
}

export function temNovidadeIdentificada(c: LegalCase): boolean {
  return !!(
    resolveTemNovoAndamento(c) ||
    c.tem_novo_andamento ||
    (c as any).tem_atualizacao_pos_retorno ||
    (c as any).djen_nova_comunicacao
  );
}

export function temAudienciaPendente(c: LegalCase): boolean {
  // LOTE3: não basta a palavra "audiência" — exige designação/data (audiencia-detect)
  if (hasAudienciaPosRetorno(c)) return true;
  if (String(c.evento_tipo || '').startsWith('audiencia') && (c as any).tem_audiencia !== false) {
    // evento_tipo já classificado pelo scan (mais confiável que keyword solta)
    return true;
  }
  const resumo = String(
    c.evento_resumo || (c as any).datajud_ultimo_nome || (c as any).djen_ultimo_resumo || ''
  );
  const det = detectarAudienciaPendente(resumo);
  if (det.isAudienciaPendente) return true;
  // Flag explícita só se veio do classificador (não indício frágil)
  if ((c as any).tem_audiencia === true && det.motivo !== 'apenas menção da palavra') return true;
  return false;
}

export function temCumprimento(c: LegalCase): boolean {
  return !!(
    c.em_cumprimento_sentenca ||
    c.evento_tipo === 'cumprimento_sentenca' ||
    (c as any).cumprimento_sentenca
  );
}

/** Casos que exigem ação / risco (fila “problemáticos”). */
export function isCasoProblematico(c: LegalCase, baHits?: BaHitIndex): boolean {
  if (temBaCarteira(c, baHits)) return true;
  if (c.datajud_encerrado_tribunal) return true;
  if (isSentencaImprocedente(c)) return true;
  if (temCumprimento(c)) return true;
  if (temNovidadeIdentificada(c)) return true;
  if (temAudienciaPendente(c)) return true;
  if ((c as any).tem_custas || (c as any).alerta_custas) return true;
  if ((c as any).prioridade_critica_ia || (c as any).alerta_ia) return true;
  if (['Caso Crítico', 'Vencido', 'É Hoje'].includes(c.status || '')) return true;
  return false;
}

/** Sem sinal crítico recente — acompanhamento de rotina. */
export function isCasoTranquilo(c: LegalCase, baHits?: BaHitIndex): boolean {
  if (isCasoProblematico(c, baHits)) return false;
  if (['Atenção'].includes(c.status || '')) return false;
  return true;
}

export function countBaFromCases(
  cases: LegalCase[],
  baHits?: BaHitIndex
): number {
  const seen = new Set<string>();
  for (const c of cases) {
    if (!temBaCarteira(c, baHits)) continue;
    const k = normalizeProtocolo(c.protocolo) || c.protocolo || `tmp_${Date.now()}`;
    seen.add(k);
  }
  // hits só nos logs sem match na carteira ainda contam no dashboard
  if (baHits) {
    for (const h of baHits) seen.add(h);
  }
  return seen.size;
}
