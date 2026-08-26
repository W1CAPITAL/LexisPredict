/**
 * Escopo de fila do scanner: só candidatos a procedência / cumprimento / honorários.
 * Usado no scanner local, nuvem e na aba Ações Procedentes.
 */
import type { LegalCase } from '@/lib/case-logic';
import { isCasoEncerrado } from '@/lib/status-encerrado';

export type ScanScope = 'full' | 'cumprimento';

const EVENTOS_EXEC = new Set([
  'sentenca_procedente',
  'sentenca_improcedente',
  'transito_baixa',
  'transito_ou_baixa',
  'cumprimento_sentenca',
  'baixa_tribunal',
]);

/**
 * Candidato a varredura focada em cumprimento / procedentes.
 * Inclui já flagados, encerrados no tribunal e sinais textuais de mérito/execução.
 */
export function isCandidatoCumprimentoScan(c: LegalCase | null | undefined): boolean {
  if (!c) return false;
  const dados =
    (c as any).dados && typeof (c as any).dados === 'object' ? ((c as any).dados as any) : {};

  if (c.is_procedente || dados.is_procedente) return true;
  if (c.cumprimento_pendente_necessario || dados.cumprimento_pendente_necessario) return true;
  if (c.em_cumprimento_sentenca || dados.em_cumprimento_sentenca) return true;
  if (dados.cumprimento_ativo || dados.cumprimento_encerrado) return true;
  if (dados.status_executivo && String(dados.status_executivo) !== 'nenhum') return true;
  if ((c as any).oportunidade_elegivel || dados.oportunidade_elegivel) return true;
  if (c.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal) return true;
  if (isCasoEncerrado(c)) return true;

  const ev = String(c.evento_tipo || dados.evento_tipo || '').toLowerCase();
  if (EVENTOS_EXEC.has(ev)) return true;

  const blob = [
    c.datajud_ultimo_nome,
    c.evento_resumo,
    (c as any).procedente_motivo,
    (c as any).cumprimento_sentenca_motivo,
    dados.procedente_motivo,
    dados.cumprimento_sentenca_motivo,
    dados.datajud_ultimo_nome,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (
    /PROCEDENTE|IMPROCEDENTE|CUMPRIMENTO\s+DE\s+SENTEN[CÇ]A|TR[AÂ]NSITO\s+EM\s+JULGADO|BAIXA\s+DEFINITIVA|HONOR[AÁ]RIOS|SUCUMB[EÊ]NCIA|ALVAR[AÁ]\s+DE\s+LEVANTAMENTO|EXECU[CÇ][AÃ]O\s+DE\s+SENTEN[CÇ]A/.test(
      blob
    )
  ) {
    return true;
  }

  return false;
}

/** Filtra e prioriza: pendente instauração > procedente > em cumprimento > demais. */
export function filterQueueByScanScope(
  cases: LegalCase[],
  scope: ScanScope
): { queue: LegalCase[]; filteredOut: number; scope: ScanScope } {
  if (scope !== 'cumprimento') {
    return { queue: cases, filteredOut: 0, scope: 'full' };
  }
  const hit: LegalCase[] = [];
  const rest: LegalCase[] = [];
  for (const c of cases) {
    if (isCandidatoCumprimentoScan(c)) hit.push(c);
    else rest.push(c);
  }

  const rank = (c: LegalCase) => {
    const d = ((c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {}) as any;
    if (c.cumprimento_pendente_necessario || d.cumprimento_pendente_necessario) return 0;
    if (c.is_procedente || d.is_procedente) return 1;
    if (c.em_cumprimento_sentenca || d.em_cumprimento_sentenca) return 2;
    if (isCasoEncerrado(c) || c.datajud_encerrado_tribunal) return 3;
    return 4;
  };
  hit.sort((a, b) => rank(a) - rank(b));

  return {
    queue: hit,
    filteredOut: rest.length,
    scope: 'cumprimento',
  };
}
