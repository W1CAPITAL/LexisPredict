/**
 * Um chip principal por processo — evita 5 badges dizendo a mesma coisa.
 */
import type { LegalCase } from './case-logic';

export type StatusChip = {
  label: string;
  tone: 'danger' | 'warn' | 'info' | 'ok' | 'muted' | 'dark';
  /** texto curto opcional (pred, etc.) */
  hint?: string;
};

function dados(c: LegalCase): any {
  const d = (c as any).dados;
  return d && typeof d === 'object' ? d : {};
}

/** Prioridade: BA > baixa/trânsito > cumprimento > procedente/improcedente > novidade > audiência > monitoramento */
export function getStatusChip(c: LegalCase | null | undefined): StatusChip {
  if (!c) return { label: '—', tone: 'muted' };
  const d = dados(c);

  if ((c as any).indicio_busca_apreensao || d.indicio_busca_apreensao) {
    return { label: 'Busca e apreensão', tone: 'danger' };
  }
  if ((c as any).datajud_encerrado_tribunal || d.datajud_encerrado_tribunal) {
    return { label: 'Baixa / trânsito', tone: 'dark' };
  }
  if (
    (c as any).em_cumprimento_sentenca ||
    d.em_cumprimento_sentenca ||
    (c as any).status_executivo === 'ativo' ||
    d.status_executivo === 'ativo'
  ) {
    return { label: 'Cumprimento', tone: 'warn' };
  }
  if ((c as any).is_procedente || d.is_procedente || (c as any).evento_tipo === 'sentenca_procedente') {
    return { label: 'Procedente', tone: 'ok' };
  }
  if ((c as any).evento_tipo === 'sentenca_improcedente' || d.is_improcedente) {
    return { label: 'Improcedente', tone: 'muted' };
  }
  if (
    (c as any).tem_novo_andamento ||
    (c as any).tem_atualizacao_pos_retorno ||
    (c as any).djen_nova_comunicacao
  ) {
    return { label: 'Novidade', tone: 'info' };
  }
  if (String((c as any).evento_tipo || '').includes('audiencia')) {
    return { label: 'Audiência', tone: 'info' };
  }
  if (c.status === 'Vencido' || c.status === 'Caso Crítico') {
    return { label: 'Prazo vencido', tone: 'danger' };
  }
  if (c.status === 'É Hoje') return { label: 'Prazo hoje', tone: 'warn' };
  return { label: 'Em acompanhamento', tone: 'muted' };
}

export function chipClass(tone: StatusChip['tone']): string {
  switch (tone) {
    case 'danger':
      return 'bg-red-600 text-white border-transparent';
    case 'warn':
      return 'bg-amber-500 text-black border-transparent';
    case 'info':
      return 'bg-blue-600 text-white border-transparent';
    case 'ok':
      return 'bg-emerald-600 text-white border-transparent';
    case 'dark':
      return 'bg-slate-900 text-white border-transparent';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
