/**
 * Prioridade operacional unificada — Fila (/tarefas) + Carteira (/cases)
 * Ordem: BA > baixa/encerrado tribunal > mérito/novidade > cumprimento >
 *        prazo vencido > é hoje > atenção > sem retorno longo > resto
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */
import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { diasAtePrazo, statusEfetivo } from './prazo-status';

export type PriorityBand =
  | 'ba'
  | 'encerrado_tribunal'
  | 'novidade'
  | 'cumprimento'
  | 'vencido'
  | 'hoje'
  | 'atencao'
  | 'sem_retorno'
  | 'normal';

export interface PriorityResult {
  score: number;
  band: PriorityBand;
  label: string;
}

function upper(v: unknown): string {
  return String(v || '').toUpperCase();
}

function dias(c: LegalCase): number | null {
  try {
    const d = diasAtePrazo((c as any).proximoPrazo);
    if (d !== null && d !== undefined) return d;
  } catch {
    /* */
  }
  if (typeof (c as any).diasFaltando === 'number') return (c as any).diasFaltando;
  return null;
}

function statusOf(c: LegalCase): string {
  try {
    return String(statusEfetivo(c) || c.status || '');
  } catch {
    return String(c.status || '');
  }
}

/** Score 0–1000: maior = tratar primeiro */
export function scoreCasePriority(c: LegalCase): PriorityResult {
  if (!c) return { score: 0, band: 'normal', label: '—' };

  const st = statusOf(c);
  const hasBA = !!(c as any).indicio_busca_apreensao;
  const closedCourt = !!(c as any).datajud_encerrado_tribunal;
  const novidade =
    !!(c as any).tem_novo_andamento ||
    !!(c as any).tem_atualizacao_pos_retorno ||
    !!(c as any).djen_nova_comunicacao;
  const cumprimento = !!(c as any).em_cumprimento_sentenca;
  const evento = upper((c as any).evento_tipo || (c as any).eventoTipo);

  if (hasBA || evento === 'BA') {
    return { score: 1000, band: 'ba', label: 'B.A.' };
  }
  if (closedCourt && !isCasoEncerrado(c)) {
    return { score: 920, band: 'encerrado_tribunal', label: 'Baixa tribunal' };
  }
  if (
    evento.includes('SENTENCA') ||
    evento.includes('SENTENÇA') ||
    evento.includes('PROCEDENTE') ||
    evento.includes('IMPROCEDENTE')
  ) {
    return { score: 880, band: 'novidade', label: 'Mérito' };
  }
  if (novidade) {
    return { score: 820, band: 'novidade', label: 'Novidade' };
  }
  if (cumprimento || evento.includes('CUMPRIMENTO')) {
    return { score: 760, band: 'cumprimento', label: 'Cumprimento' };
  }

  const d = dias(c);
  if (st === 'Vencido' || st === 'Caso Crítico' || (d !== null && d < 0)) {
    return { score: 700 + Math.min(99, Math.abs(d ?? 0)), band: 'vencido', label: 'Vencido' };
  }
  if (st === 'É Hoje' || d === 0) {
    return { score: 650, band: 'hoje', label: 'É hoje' };
  }
  if (st === 'Atenção' || (d !== null && d > 0 && d <= 3)) {
    return { score: 600 - (d ?? 0), band: 'atencao', label: 'Atenção' };
  }

  // Sem retorno recente: prioriza quem está há mais tempo sem contato
  const ur = String((c as any).ultimoRetorno || (c as any).ultimo_retorno || '').trim();
  if (!ur) {
    return { score: 420, band: 'sem_retorno', label: 'Sem retorno' };
  }

  return { score: 200, band: 'normal', label: 'Rotina' };
}

export function compareByPriority(a: LegalCase, b: LegalCase): number {
  const sa = scoreCasePriority(a).score;
  const sb = scoreCasePriority(b).score;
  if (sb !== sa) return sb - sa;
  // desempate: cliente
  return String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR');
}

/** Ordena carteira pela prioridade operacional */
export function sortCasesByPriority(cases: LegalCase[]): LegalCase[] {
  return [...cases].sort(compareByPriority);
}

/** Score agregado de um grupo (cliente com vários processos) — max + bônus */
export function scoreGroupPriority(cases: LegalCase[]): PriorityResult {
  if (!cases?.length) return { score: 0, band: 'normal', label: '—' };
  let best = scoreCasePriority(cases[0]);
  for (let i = 1; i < cases.length; i++) {
    const s = scoreCasePriority(cases[i]);
    if (s.score > best.score) best = s;
  }
  return best;
}
