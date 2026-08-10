/**
 * Status de prazo com calendário de Brasília (evita erro Vercel UTC).
 * Fonte única para Dashboard, Agenda e processarCaso.
 * @copyright 2026 W1 / LexisPredict
 */

import type { CaseStatus } from './case-logic';

const TZ = 'America/Sao_Paulo';

/** YYYY-MM-DD de "hoje" em Brasília */
export function hojeBrasilISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Normaliza qualquer data de prazo para YYYY-MM-DD ou null */
export function normalizarDataPrazo(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s === '0' || s === '00/00/0000') return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // dd/MM/yyyy ou dd-MM-yyyy
  const br = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  // dd/MM/yy
  const br2 = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})$/);
  if (br2) {
    const yy = parseInt(br2[3], 10);
    const yyyy = yy > 50 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${br2[2]}-${br2[1]}`;
  }

  // tenta Date parse
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(t));
  }
  return null;
}

/** Dias até o prazo: negativo = vencido. Usa só datas civis YYYY-MM-DD. */
export function diasAtePrazo(
  prazoRaw: string | null | undefined,
  hojeISO?: string
): number | null {
  const prazo = normalizarDataPrazo(prazoRaw);
  if (!prazo) return null;
  const hoje = hojeISO || hojeBrasilISO();
  // comparação em epoch UTC noon para evitar DST edge
  const a = Date.UTC(
    parseInt(prazo.slice(0, 4), 10),
    parseInt(prazo.slice(5, 7), 10) - 1,
    parseInt(prazo.slice(8, 10), 10)
  );
  const b = Date.UTC(
    parseInt(hoje.slice(0, 4), 10),
    parseInt(hoje.slice(5, 7), 10) - 1,
    parseInt(hoje.slice(8, 10), 10)
  );
  return Math.round((a - b) / 86400000);
}

export function statusPorPrazo(
  prazoRaw: string | null | undefined,
  opts?: { alertLimit?: number; situacao?: string | null }
): CaseStatus {
  const sit = String(opts?.situacao || '').toUpperCase();
  if (
    /ENCERRADO|ARQUIVADO|EXTINTO|BAIXA DEFINITIVA|FINALIZADO|SUSPENSO/.test(sit)
  ) {
    return 'Arquivado';
  }
  const dias = diasAtePrazo(prazoRaw);
  if (dias === null) return 'Sem Prazo';
  if (dias < 0) return 'Vencido';
  if (dias === 0) return 'É Hoje';
  const limit = opts?.alertLimit ?? 3;
  if (dias <= limit) return 'Atenção';
  return 'No Prazo';
}

/**
 * Status efetivo para métricas: recalcula do prazo.
 * Só respeita statusManual se for valor operacional explícito (não data/prazo).
 */
export function statusEfetivo(c: {
  proximoPrazo?: string | null;
  status?: string | null;
  statusManual?: string | null;
  situacao?: string | null;
}): CaseStatus {
  const manual = String(c.statusManual || 'Automatico');
  const fixed = ['Caso Crítico', 'Arquivado', 'Encerrado'];
  if (manual && manual !== 'Automatico' && fixed.includes(manual)) {
    return manual as CaseStatus;
  }
  // Se status gravado parece de prazo, sempre recalcula (evita cache velho)
  return statusPorPrazo(c.proximoPrazo, { situacao: c.situacao });
}
