/**
 * Filtros e ordenação da carteira (Processos + Tarefas).
 * Usa statusEfetivo / diasAtePrazo quando disponíveis.
 */
import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { diasAtePrazo, statusEfetivo } from './prazo-status';

export type SortPrazoMode =
  | 'mais_vencido' // mais dias em atraso primeiro
  | 'menos_vencido' // menos atraso / mais próximo
  | 'prazo_asc' // quem vence primeiro (hoje/atenção antes)
  | 'cliente'
  | 'default';

export type QuickFilter =
  | 'all'
  | 'hoje'
  | 'vencido'
  | 'active'
  | 'updated'
  | 'closed'
  | 'atencao'
  | 'sem_prazo';

function dias(c: LegalCase): number | null {
  const d = diasAtePrazo(c.proximoPrazo);
  if (d !== null && d !== undefined) return d;
  if (typeof c.diasFaltando === 'number') return c.diasFaltando;
  return null;
}

function statusOf(c: LegalCase): string {
  try {
    return String(statusEfetivo(c) || c.status || '');
  } catch {
    return String(c.status || '');
  }
}

/** Lista única de advogados da carteira */
export function listAdvogados(cases: LegalCase[]): string[] {
  const set = new Set<string>();
  for (const c of cases) {
    const a = String(c.advogado || '')
      .trim()
      .toUpperCase();
    if (a && a !== 'NÃO ATRIBUÍDO' && a !== 'NAO ATRIBUIDO') set.add(a);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filterCases(
  cases: LegalCase[],
  opts: {
    search?: string;
    quick?: QuickFilter | string;
    advogado?: string; // 'all' | nome
    onlyActive?: boolean;
  }
): LegalCase[] {
  const q = (opts.search || '').toLowerCase().trim();
  const adv = (opts.advogado || 'all').toUpperCase();
  const quick = opts.quick || 'all';

  return cases.filter((c) => {
    if (opts.onlyActive && isCasoEncerrado(c)) return false;

    if (q) {
      const hay = [
        c.cliente,
        c.protocolo,
        c.advogado,
        c.observacao,
        c.escritorio,
        c.tribunal,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      if (!hay.includes(q)) return false;
    }

    if (adv && adv !== 'ALL') {
      if (String(c.advogado || '').trim().toUpperCase() !== adv) return false;
    }

    const st = statusOf(c);
    if (quick === 'updated') return !!c.tem_novo_andamento || !!c.tem_atualizacao_pos_retorno;
    if (quick === 'active') return !isCasoEncerrado(c);
    if (quick === 'closed') return isCasoEncerrado(c);
    if (quick === 'hoje' || quick === 'today') return st === 'É Hoje';
    if (quick === 'vencido') return st === 'Vencido' || st === 'Caso Crítico' || c.statusManual === 'Caso Crítico';
    if (quick === 'atencao') return st === 'Atenção';
    if (quick === 'sem_prazo') return st === 'Sem Prazo';
    return true;
  });
}

/**
 * Ordenação por prazo:
 * - mais_vencido: dias negativos mais baixos primeiro (-90 antes de -1)
 * - menos_vencido: menos atraso primeiro (-1 antes de -90); sem prazo no fim
 * - prazo_asc: quem vence primeiro (0, 1, 2… depois vencidos)
 */
export function sortCasesByPrazo(cases: LegalCase[], mode: SortPrazoMode): LegalCase[] {
  const arr = [...cases];
  if (mode === 'cliente') {
    return arr.sort((a, b) => String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR'));
  }
  if (mode === 'default') return arr;

  return arr.sort((a, b) => {
    const da = dias(a);
    const db = dias(b);
    // null (sem prazo) sempre no fim
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;

    if (mode === 'mais_vencido') {
      // mais negativo primeiro
      if (da !== db) return da - db;
    } else if (mode === 'menos_vencido') {
      // entre vencidos: -1 antes de -90; quem não venceu depois
      const aV = da < 0;
      const bV = db < 0;
      if (aV && bV) return db - da; // -1 (maior) antes de -90
      if (aV && !bV) return -1;
      if (!aV && bV) return 1;
      return da - db;
    } else if (mode === 'prazo_asc') {
      return da - db;
    }
    return 0;
  });
}

/** Fila de scanner: críticos/vencidos primeiro, depois hoje, atenção, novidade, resto */
export function prioritizeScanQueue(cases: LegalCase[]): LegalCase[] {
  return [...cases].sort((a, b) => {
    const score = (c: LegalCase) => {
      let s = 0;
      const st = statusOf(c);
      if (c.statusManual === 'Caso Crítico' || st === 'Caso Crítico') s += 5000;
      if (st === 'Vencido') s += 4000;
      if (st === 'É Hoje') s += 3000;
      if (st === 'Atenção') s += 2000;
      if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno) s += 1500;
      if ((c as any).indicio_busca_apreensao) s += 4500;
      if ((c as any).em_cumprimento_sentenca) s += 1200;
      const d = dias(c);
      if (d !== null && d < 0) s += Math.min(800, Math.abs(d) * 2);
      return s;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return String(a.protocolo || '').localeCompare(String(b.protocolo || ''));
  });
}
