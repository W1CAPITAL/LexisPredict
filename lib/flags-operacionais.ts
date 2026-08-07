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

/** Protocolos com hit real na aba B.A. (ba_scan_logs / fila). */
export type BaHitIndex = Set<string>;

export function normalizeProtocolo(p: string | null | undefined): string {
  return String(p || '')
    .replace(/\D/g, '')
    .slice(0, 20);
}

export function temBaCarteira(c: LegalCase, baHits?: BaHitIndex): boolean {
  const proto = normalizeProtocolo(c.protocolo);
  if (baHits && proto && baHits.has(proto)) return true;
  if (c.evento_tipo === 'ba') return true;
  if ((c as any).indicio_busca_apreensao) return true;
  if ((c as any).ba_tipo) return true;
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
  if ((c as any).tem_audiencia === true) return true;
  if (String(c.evento_tipo || '').startsWith('audiencia')) return true;
  if (hasAudienciaPosRetorno(c)) return true;
  const resumo = String(
    c.evento_resumo || (c as any).datajud_ultimo_nome || (c as any).djen_ultimo_resumo || ''
  );
  if (/AUDI[EÊ]NCIA|CONCILIA/i.test(resumo) && !/REALIZADA|CANCELADA|DESMARCADA/i.test(resumo)) {
    return true;
  }
  // Data futura no resumo (dd/mm/yyyy)
  const m = resumo.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (m && /AUDI/i.test(resumo)) {
    try {
      const [dd, mm, yyyy] = m[1].split('/').map(Number);
      const d = new Date(yyyy, mm - 1, dd);
      if (d.getTime() >= Date.now() - 86400000) return true;
    } catch {
      /* */
    }
  }
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
    const k = normalizeProtocolo(c.protocolo) || c.protocolo || String(Math.random());
    seen.add(k);
  }
  // hits só nos logs sem match na carteira ainda contam no dashboard
  if (baHits) {
    for (const h of baHits) seen.add(h);
  }
  return seen.size;
}
