/**
 * @fileOverview Governança de Status Inativos v100.0
 * Centraliza a definição de casos que não devem compor filas de atendimento ou KPIs ativos.
 */

export const STATUS_ENCERRADOS = ['ENCERRADO', 'ARQUIVADO', 'EXTINTO', 'SUSPENSO', 'IMOVEL', 'IMÓVEL'];

export function isCasoEncerrado(c: any): boolean {
  if (!c) return false;
  const s = `${c.status || ''} ${c.situacao || ''} ${c.statusManual || ''}`.toUpperCase();
  return STATUS_ENCERRADOS.some(x => s.includes(x));
}
