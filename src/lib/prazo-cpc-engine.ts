/**
 * Motor GRATUITO de prazos processuais (CPC art. 219 / 220 / 224).
 * Não depende de API paga. Feriados nacionais + UF + recesso forense.
 * Referência de prática: mesma lógica recomendada pelo skill TecJustica
 * ("calcule manualmente — não existe tool de calculadora no MCP").
 * @copyright 2026 W1 / LexisPredict
 */

import {
  isDiaUtil,
  isDiaUtilForense,
  proximoDiaUtilForense,
  isRecessoForense,
  ufFromTribunal,
  type UfCode,
} from './calendario-tj';
import { addDiasUteis as addUteisBase } from './prazos-cpc';

export type PrazoModo = 'uteis' | 'corridos';

export type ContagemInput = {
  /** Data da intimação / publicação (disponibilização DJEN ou ciência) */
  dataBase: Date | string;
  /** Quantidade de dias do prazo legal (ex.: 15 contestação) */
  dias: number;
  /** Dias úteis (CPC) ou corridos (ex.: alguns prazos penais/CPP) */
  modo?: PrazoModo;
  /** Considerar recesso forense 20/12–20/01 (CPC art. 220) */
  suspenderRecesso?: boolean;
  /** Tribunal ou UF para feriado estadual */
  tribunal?: string | null;
  uf?: UfCode | null;
  /**
   * Se true, o prazo começa no 1º dia útil SEGUINTE à data-base
   * (regra geral CPC art. 224 — exclui o dia do começo).
   */
  excluirDiaComeco?: boolean;
};

export type ContagemResult = {
  inicioContagem: string; // ISO date
  vencimento: string;
  vencimentoLabel: string; // dd/MM/yyyy
  diasSolicitados: number;
  modo: PrazoModo;
  uf: UfCode | null;
  recessoAtingido: boolean;
  feriadosPulados: string[];
  observacao: string;
  ok: boolean;
};

function toDate(d: Date | string): Date {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const s = String(d).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.slice(0, 10).split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const x = new Date(s);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function br(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Conta prazo processual gratuito e offline.
 */
export function contarPrazo(input: ContagemInput): ContagemResult {
  const modo = input.modo || 'uteis';
  const excluir = input.excluirDiaComeco !== false;
  const recesso = input.suspenderRecesso !== false;
  const uf = input.uf || ufFromTribunal(input.tribunal) || null;
  const feriadosPulados: string[] = [];
  let recessoAtingido = false;

  let cursor = toDate(input.dataBase);

  if (excluir) {
    cursor.setDate(cursor.getDate() + 1);
  }

  // Ajusta início para dia útil forense se modo úteis
  if (modo === 'uteis') {
    let guard = 0;
    while (
      (!isDiaUtil(cursor, { uf }) || (recesso && isRecessoForense(cursor))) &&
      guard < 60
    ) {
      if (recesso && isRecessoForense(cursor)) recessoAtingido = true;
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }

  const inicio = new Date(cursor);

  if (modo === 'corridos') {
    cursor.setDate(cursor.getDate() + Math.max(0, input.dias - (excluir ? 0 : 0)));
    // corridos: soma dias-1 se já estamos no 1º dia da contagem inclusiva no fim
    // Padrão: N dias corridos a partir do início → + (N-1) se incluir o dia inicial como dia 1
    cursor = new Date(inicio);
    cursor.setDate(inicio.getDate() + Math.max(0, input.dias - 1));
  } else {
    let counted = 0;
    cursor = new Date(inicio);
    // O dia de início já conta como 1º dia útil se for útil
    while (counted < input.dias) {
      if (
        isDiaUtil(cursor, { uf }) &&
        !(recesso && isRecessoForense(cursor))
      ) {
        counted++;
        if (counted >= input.dias) break;
      } else {
        if (recesso && isRecessoForense(cursor)) recessoAtingido = true;
      }
      if (counted < input.dias) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  // Se vencimento cair em não útil, empurra (prazo processuais)
  if (modo === 'uteis' || modo === 'corridos') {
    let guard = 0;
    while (
      (!isDiaUtil(cursor, { uf }) || (recesso && isRecessoForense(cursor))) &&
      guard < 40
    ) {
      if (recesso && isRecessoForense(cursor)) recessoAtingido = true;
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }

  const obsParts = [
    modo === 'uteis'
      ? 'Contagem em dias úteis (CPC art. 219).'
      : 'Contagem em dias corridos.',
    excluir ? 'Excluiu-se o dia do começo (art. 224).' : 'Dia do começo incluído.',
    recesso ? 'Recesso forense considerado (art. 220).' : 'Recesso não aplicado.',
    uf ? `Feriados de ${uf} considerados.` : 'Somente feriados nacionais.',
    'Motor local gratuito — confira sempre o calendário oficial do tribunal.',
  ];

  return {
    inicioContagem: iso(inicio),
    vencimento: iso(cursor),
    vencimentoLabel: br(cursor),
    diasSolicitados: input.dias,
    modo,
    uf,
    recessoAtingido,
    feriadosPulados,
    observacao: obsParts.join(' '),
    ok: true,
  };
}

/** Atalhos comuns */
export const PRAZOS_COMUNS = [
  { id: 'contestacao', label: 'Contestação (15 úteis)', dias: 15, modo: 'uteis' as PrazoModo },
  { id: 'replica', label: 'Réplica (15 úteis)', dias: 15, modo: 'uteis' as PrazoModo },
  { id: 'recurso_apelacao', label: 'Apelação (15 úteis)', dias: 15, modo: 'uteis' as PrazoModo },
  { id: 'embargos_declaracao', label: 'Embargos de declaração (5 úteis)', dias: 5, modo: 'uteis' as PrazoModo },
  { id: 'agravo_instrumento', label: 'Agravo de instrumento (15 úteis)', dias: 15, modo: 'uteis' as PrazoModo },
  { id: 'cumprimento_pagar', label: 'Cumprimento — pagar (15 úteis)', dias: 15, modo: 'uteis' as PrazoModo },
  { id: 'manifestacao_generica', label: 'Manifestação (5 úteis)', dias: 5, modo: 'uteis' as PrazoModo },
  { id: 'manifestacao_10', label: 'Manifestação (10 úteis)', dias: 10, modo: 'uteis' as PrazoModo },
] as const;
