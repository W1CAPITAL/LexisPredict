/**
 * @fileOverview Governança de Status Inativos v12.0
 * Centraliza a definição de casos que não devem compor filas de atendimento ou KPIs ativos.
 * Considera flags do tribunal (DataJud) além de status textual.
 */

export const STATUS_ENCERRADOS = [
  'ENCERRADO',
  'ARQUIVADO',
  'EXTINTO',
  'SUSPENSO',
  'IMOVEL',
  'IMÓVEL',
  'BAIXA DEFINITIVA',
  'TRÂNSITO EM JULGADO',
  'TRANSITO EM JULGADO',
];

export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;

  // Flag forense do tribunal
  if (c.datajud_encerrado_tribunal === true) return true;

  // Evento classificado como trânsito/baixa
  if (
    c.evento_tipo === 'transito_ou_baixa' ||
    c.evento_tipo === 'transito_baixa'
  ) {
    return true;
  }

  const s = `${c.status || ''} ${c.situacao || ''} ${c.statusManual || ''}`.toUpperCase();
  return STATUS_ENCERRADOS.some((x) => s.includes(x));
}
