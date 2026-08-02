/**
 * Pontuação de escritório / advogado — inclui mérito (sentença e audiência).
 * Reutilizável no OfficeStats e no Dossiê.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { resolveTemNovoAndamento } from './novidade';
import {
  hasAudienciaPosRetorno,
  isSentencaImprocedente,
  isSentencaProcedente,
} from './merito-detect';

export type UnitScore = {
  key: string;
  total: number;
  vencidos: number;
  novidades: number;
  baixas: number;
  procedentes: number;
  improcedentes: number;
  audiencias: number;
  /** Saldo líquido (maior = melhor) */
  authorityPoints: number;
  label: string;
};

function basePoints(c: LegalCase): number {
  let p = 0;
  if (c.status === 'No Prazo') p += 2;
  if (c.status === 'Atenção') p -= 1;
  if (c.status === 'É Hoje') p -= 3;
  if (c.status === 'Vencido' || c.status === 'Caso Crítico') p -= 5;
  if (resolveTemNovoAndamento(c)) p -= 2;
  if (c.datajud_encerrado_tribunal) p += 4;
  if (c.em_cumprimento_sentenca) p += 1;

  // Mérito (DataJud e/ou DJEN via evento_tipo)
  if (isSentencaProcedente(c)) p += 8;
  if (isSentencaImprocedente(c)) p -= 6;
  if (c.evento_tipo === 'sentenca_parcial') p += 2;
  if (hasAudienciaPosRetorno(c)) p -= 3; // exige ação — penaliza se ainda na fila ativa

  return p;
}

export function scoreByGroup(
  cases: LegalCase[],
  groupBy: 'escritorio' | 'advogado'
): UnitScore[] {
  const map = new Map<string, UnitScore>();

  for (const c of cases) {
    if (isCasoEncerrado(c)) continue;
    const key =
      groupBy === 'escritorio'
        ? (c.escritorio || 'SEM ESCRITÓRIO').trim().toUpperCase() || 'SEM ESCRITÓRIO'
        : (c.advogado || 'NÃO ATRIBUÍDO').trim().toUpperCase() || 'NÃO ATRIBUÍDO';

    let row = map.get(key);
    if (!row) {
      row = {
        key,
        total: 0,
        vencidos: 0,
        novidades: 0,
        baixas: 0,
        procedentes: 0,
        improcedentes: 0,
        audiencias: 0,
        authorityPoints: 0,
        label: key,
      };
      map.set(key, row);
    }

    row.total += 1;
    if (c.status === 'Vencido' || c.status === 'Caso Crítico') row.vencidos += 1;
    if (resolveTemNovoAndamento(c)) row.novidades += 1;
    if (c.datajud_encerrado_tribunal) row.baixas += 1;
    if (isSentencaProcedente(c)) row.procedentes += 1;
    if (isSentencaImprocedente(c)) row.improcedentes += 1;
    if (hasAudienciaPosRetorno(c)) row.audiencias += 1;
    row.authorityPoints += basePoints(c);
  }

  return Array.from(map.values()).sort((a, b) => b.authorityPoints - a.authorityPoints);
}

export function scoreLabel(points: number): { label: string; tone: string } {
  if (points >= 20) return { label: 'Unidade Elite', tone: 'text-emerald-600' };
  if (points >= 0) return { label: 'Operação Estável', tone: 'text-blue-600' };
  if (points >= -30) return { label: 'Atenção', tone: 'text-amber-600' };
  return { label: 'Risco Crítico', tone: 'text-red-600' };
}
