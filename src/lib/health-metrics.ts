/**
 * Métricas de saúde da carteira (supervisão).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { resolveTemNovoAndamento } from './novidade';
import { hasAudienciaPosRetorno } from './merito-detect';

function daysSince(isoOrBr: string | null | undefined): number | null {
  if (!isoOrBr) return null;
  try {
    const raw = String(isoOrBr).trim();
    const d = new Date(raw.includes('/') ? raw.split('/').reverse().join('-') : raw);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  } catch {
    return null;
  }
}

export type HealthSnapshot = {
  ativos: number;
  /** % com datajud_consultado_em ou djen_consultado_em nos últimos 7 dias */
  pctAuditada7d: number;
  /** novidades abertas há mais de N dias sem novo retorno */
  novidadesAbertasMaisDe: number;
  diasLimiteNovidade: number;
  audienciaSemContato: number;
  semConsultaNunca: number;
};

export function buildHealthSnapshot(
  cases: LegalCase[],
  opts?: { diasNovidade?: number }
): HealthSnapshot {
  const diasLimiteNovidade = opts?.diasNovidade ?? 7;
  const ativos = cases.filter((c) => !isCasoEncerrado(c));
  const n = ativos.length || 1;

  let auditada7d = 0;
  let novidadesAbertasMaisDe = 0;
  let audienciaSemContato = 0;
  let semConsultaNunca = 0;

  for (const c of ativos) {
    const dj = daysSince(c.datajud_consultado_em);
    const djen = daysSince(c.djen_consultado_em);
    const lastAudit = [dj, djen].filter((x) => x !== null) as number[];
    if (lastAudit.length === 0) semConsultaNunca += 1;
    else if (Math.min(...lastAudit) <= 7) auditada7d += 1;

    if (resolveTemNovoAndamento(c)) {
      const movDays = daysSince(
        c.evento_data || c.datajud_ultimo_movimento || c.djen_ultima_data
      );
      if (movDays !== null && movDays >= diasLimiteNovidade) novidadesAbertasMaisDe += 1;
      else if (movDays === null) novidadesAbertasMaisDe += 1;
    }

    if (hasAudienciaPosRetorno(c) && resolveTemNovoAndamento(c)) {
      audienciaSemContato += 1;
    }
  }

  return {
    ativos: ativos.length,
    pctAuditada7d: Math.round((auditada7d / n) * 100),
    novidadesAbertasMaisDe,
    diasLimiteNovidade,
    audienciaSemContato,
    semConsultaNunca,
  };
}
