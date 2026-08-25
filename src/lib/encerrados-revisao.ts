/**
 * Encerrados a revisar — fila de segurança operacional.
 * Objetivo: nenhum encerramento automático (ou restaurado) passar sem olho humano
 * quando ainda há valor, cumprimento, procedente ou dúvida.
 */

import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { isSentencaProcedente, isSentencaImprocedente } from './merito-detect';

export type FlagRevisao = {
  id: string;
  label: string;
  tone: 'critico' | 'alto' | 'medio' | 'info';
};

export type ItemEncerradoRevisao = {
  case: LegalCase;
  score: number;
  motivoPrincipal: string;
  flags: FlagRevisao[];
  /** sistema pode manter encerrado sem reabrir? */
  podeConfirmarAuto: boolean;
};

function blob(c: LegalCase): string {
  const d = (c as any).dados || {};
  return `${c.situacao || ''} ${c.statusManual || ''} ${(c as any).evento_resumo || ''} ${
    (c as any).datajud_encerrado_motivo || ''
  } ${d.situacao || ''} ${d.restored_from_audit || ''} ${d.restored_from_datajud || ''}`.toUpperCase();
}

function temCumprimento(c: LegalCase): boolean {
  return !!(
    (c as any).em_cumprimento_sentenca ||
    (c as any).cumprimento_ativo ||
    (c as any).cumprimento_pendente_necessario ||
    /CUMPRIMENTO/.test(blob(c))
  );
}

function foiRestauradoSistema(c: LegalCase): boolean {
  const d = (c as any).dados || {};
  return !!(
    d.restored_from_audit ||
    d.restored_from_datajud ||
    d.restored_from_status_col ||
    d.restored_from_texto
  );
}

function baixaTribunal(c: LegalCase): boolean {
  return !!(c as any).datajud_encerrado_tribunal;
}

/**
 * Política: o sistema SÓ pode sugerir "confirmar encerrado" sem reabrir quando:
 * - baixa no tribunal OU situação ENCERRADO
 * - improcedente (sinal)
 * - SEM procedente/parcial
 * - SEM cumprimento ativo/pendente
 * - SEM B.A. operacional
 */
export function podeConfirmarEncerradoSeguro(c: LegalCase): boolean {
  if (isSentencaProcedente(c as any)) return false;
  if (temCumprimento(c)) return false;
  if ((c as any).indicio_busca_apreensao) return false;
  if ((c as any).merito_resultado === 'parcial' || (c as any).sentenca_parcial) return false;
  const imp = isSentencaImprocedente(c as any) || (c as any).merito_resultado === 'improcedente';
  const fechado = isCasoEncerrado(c) || baixaTribunal(c);
  return !!(fechado && imp);
}

/**
 * Quem entra na fila "Encerrados a revisar":
 * - marcado ENCERRADO/ARQUIVADO no gabinete OU baixa tribunal
 * - E ainda tem algo que exige olho (procedente, cumprimento, restore sistema,
 *   BA, parcial, novidade após "encerrar", ou só baixa tribunal sem confirmação humana)
 */
export function precisaRevisarEncerramento(c: LegalCase): boolean {
  const encGabinete = isCasoEncerrado(c);
  const encTribunal = baixaTribunal(c);
  if (!encGabinete && !encTribunal) return false;

  // Já confirmado seguro e sem sinais de valor residual → fora da fila
  if (podeConfirmarEncerradoSeguro(c) && !foiRestauradoSistema(c) && !temCumprimento(c)) {
    // ainda assim revisar se restore em massa
    if (!foiRestauradoSistema(c)) return false;
  }

  if (isSentencaProcedente(c as any)) return true;
  if (temCumprimento(c)) return true;
  if ((c as any).merito_resultado === 'parcial' || (c as any).sentenca_parcial) return true;
  if ((c as any).indicio_busca_apreensao) return true;
  if (foiRestauradoSistema(c)) return true;
  if (encTribunal && !encGabinete) return true; // tribunal fechou, gabinete ainda não confirmou
  if (encGabinete && !(c as any).ultimoRetorno) return true; // encerrado sem atendimento registrado
  if ((c as any).tem_novo_andamento || (c as any).tem_atualizacao_pos_retorno) return true;
  if ((c as any).oportunidade_elegivel || (c as any).cumprimento_pendente_necessario) return true;

  // Improcedente + encerrado sem restore: baixa prioridade — entra só se quiser amostragem
  // (não lista todos para não poluir; operador confirma na própria aba)
  return false;
}

export function flagsEncerradoRevisao(c: LegalCase): FlagRevisao[] {
  const flags: FlagRevisao[] = [];
  if (isSentencaProcedente(c as any)) {
    flags.push({ id: 'procedente', label: 'PROCEDENTE / valor residual?', tone: 'critico' });
  }
  if (temCumprimento(c)) {
    flags.push({ id: 'cumprimento', label: 'CUMPRIMENTO DE SENTENÇA', tone: 'critico' });
  }
  if ((c as any).cumprimento_pendente_necessario) {
    flags.push({ id: 'instaurar', label: 'PENDENTE INSTAURAR CUMPRIMENTO', tone: 'alto' });
  }
  if ((c as any).merito_resultado === 'parcial' || (c as any).sentenca_parcial) {
    flags.push({ id: 'parcial', label: 'SENTENÇA PARCIAL', tone: 'alto' });
  }
  if (isSentencaImprocedente(c as any) || (c as any).merito_resultado === 'improcedente') {
    flags.push({ id: 'improcedente', label: 'IMPROCEDENTE', tone: 'info' });
  }
  if (baixaTribunal(c)) {
    flags.push({ id: 'baixa_tj', label: 'BAIXA / TRÂNSITO (tribunal)', tone: 'medio' });
  }
  if (isCasoEncerrado(c)) {
    flags.push({ id: 'gabinete', label: 'ENCERRADO NO GABINETE', tone: 'medio' });
  }
  if (foiRestauradoSistema(c)) {
    flags.push({ id: 'restore', label: 'RESTAURADO PELO SISTEMA', tone: 'alto' });
  }
  if ((c as any).tem_novo_andamento || (c as any).tem_atualizacao_pos_retorno) {
    flags.push({ id: 'novidade', label: 'NOVIDADE APÓS ENCERRAR', tone: 'critico' });
  }
  if ((c as any).oportunidade_elegivel) {
    flags.push({ id: 'oportunidade', label: 'OPORTUNIDADE / HONORÁRIOS?', tone: 'alto' });
  }
  if (!(c as any).ultimoRetorno) {
    flags.push({ id: 'sem_atendimento', label: 'SEM ÚLTIMO ATENDIMENTO', tone: 'medio' });
  }
  if ((c as any).indicio_busca_apreensao) {
    flags.push({ id: 'ba', label: 'SINAL B.A. — REVISAR', tone: 'critico' });
  }
  return flags;
}

export function scoreEncerradoRevisao(c: LegalCase): number {
  let s = 0;
  const f = flagsEncerradoRevisao(c);
  const w: Record<string, number> = {
    procedente: 900,
    cumprimento: 880,
    instaurar: 860,
    novidade: 840,
    ba: 800,
    parcial: 720,
    oportunidade: 700,
    restore: 650,
    sem_atendimento: 400,
    baixa_tj: 300,
    gabinete: 200,
    improcedente: 100,
  };
  for (const x of f) s += w[x.id] || 50;
  return s;
}

export function buildFilaEncerradosRevisao(
  cases: LegalCase[],
  limit = 12
): ItemEncerradoRevisao[] {
  const out: ItemEncerradoRevisao[] = [];
  for (const c of cases || []) {
    if (!precisaRevisarEncerramento(c)) continue;
    const flags = flagsEncerradoRevisao(c);
    const score = scoreEncerradoRevisao(c);
    const motivoPrincipal =
      flags.find((x) => x.tone === 'critico')?.label ||
      flags.find((x) => x.tone === 'alto')?.label ||
      flags[0]?.label ||
      'REVISAR ENCERRAMENTO';
    out.push({
      case: c,
      score,
      motivoPrincipal,
      flags,
      podeConfirmarAuto: podeConfirmarEncerradoSeguro(c),
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Política documentada (scanner / futuros jobs) */
export const AUTO_ENCERRAR_POLICY = {
  permitidoSomenteSe: [
    'datajud_encerrado_tribunal OU situação já ENCERRADO',
    'sinal de improcedente',
    'SEM procedente / parcial',
    'SEM cumprimento ativo ou pendente de instaurar',
    'SEM indício operacional de B.A.',
  ],
  sempreRevisarSe: [
    'procedente ou parcial',
    'cumprimento de sentença',
    'oportunidade de honorários / instaurar',
    'novidade após marcar encerrado',
    'restauração em massa pelo sistema',
  ],
} as const;
