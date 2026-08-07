/**
 * @fileOverview Governança de Status Inativos v12.2
 * Define quem NÃO entra em filas de atendimento / KPIs de carteira ativa.
 *
 * IMPORTANTE: NÃO usa datajud_encerrado_tribunal aqui.
 * Esse flag é telemetria de tribunal (KPI "Baixas") e não arquivamento operacional.
 * Arquivamento real continua sendo status/situacao/statusManual.
 */

export const STATUS_ENCERRADOS = [
  'ENCERRADO',
  'ARQUIVADO',
  'EXTINTO',
  'SUSPENSO',
  'IMOVEL',
  'IMÓVEL',
];

/**
 * Caso inativo para filas e KPIs de carteira ativa.
 * Baseado apenas em status textual operacional (não em flags de telemetria).
 */
export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const s = `${c.status || ''} ${c.situacao || ''} ${c.statusManual || ''}`.toUpperCase();
  return STATUS_ENCERRADOS.some((x) => s.includes(x));
}

/**
 * Indica baixa/trânsito detectado no tribunal (telemetria).
 * Usar para KPI "Baixas", badges e priorização — NÃO para tirar da carteira ativa.
 */
export function isBaixaTribunal(c: any): boolean {
  if (!c) return false;
  if (c.datajud_encerrado_tribunal === true) return true;
  if (c.evento_tipo === 'transito_ou_baixa' || c.evento_tipo === 'transito_baixa') return true;
  return false;
}
