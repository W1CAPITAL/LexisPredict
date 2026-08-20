/**
 * Um resumo legível no lugar de várias flags repetidas.
 */
export type ResumoChip = {
  label: string;
  tone: 'critical' | 'warn' | 'ok' | 'neutral' | 'info';
};

export function buildCaseStatusResumo(c: any): ResumoChip {
  const d = c?.dados || {};
  const ba =
    c?.indicio_busca_apreensao ||
    d?.indicio_busca_apreensao ||
    String(c?.evento_tipo || '').includes('busca');
  const baixaTribunal =
    c?.datajud_encerrado_tribunal || d?.datajud_encerrado_tribunal;
  const encCarteira =
    String(c?.status || '').toLowerCase().includes('encerr') ||
    c?.encerrado === true;
  const cumprimento =
    c?.em_cumprimento_sentenca || d?.em_cumprimento_sentenca;
  const faltaInst =
    c?.cumprimento_pendente_necessario || d?.cumprimento_pendente_necessario;
  const procedente = c?.is_procedente || d?.is_procedente;
  const novidade =
    c?.tem_novo_andamento || c?.tem_atualizacao_pos_retorno || d?.tem_novo_andamento;
  const transito = c?.data_transito_julgado || d?.data_transito_julgado;

  if (ba) return { label: 'Alerta B.A. — revisar teor', tone: 'critical' };
  if (faltaInst) return { label: 'Falta instaurar cumprimento', tone: 'warn' };
  if (cumprimento) return { label: 'Cumprimento em curso', tone: 'info' };
  if (baixaTribunal && !encCarteira) return { label: 'Baixa no tribunal', tone: 'warn' };
  if (encCarteira) return { label: 'Encerrado na carteira', tone: 'neutral' };
  if (procedente && transito) return { label: 'Procedente · trânsito', tone: 'ok' };
  if (procedente) return { label: 'Procedente', tone: 'ok' };
  if (novidade) return { label: 'Novidade / andamento novo', tone: 'info' };
  if (transito) return { label: 'Trânsito em julgado', tone: 'neutral' };

  const st = String(c?.status || c?.statusManual || '').trim();
  if (st) return { label: st, tone: 'neutral' };
  return { label: 'Em acompanhamento', tone: 'neutral' };
}

export function toneClasses(tone: ResumoChip['tone']): string {
  switch (tone) {
    case 'critical':
      return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30';
    case 'warn':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30';
    case 'ok':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30';
    case 'info':
      return 'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}
