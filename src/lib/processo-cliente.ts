/**
 * Compatibilidade com processos legados W1: 2609 processos possuem nome
 * em dados.cliente/CLIENTE mas não na coluna tipada cliente.
 * A projeção PostgREST extrai somente essas strings do JSON, sem transferir
 * o documento JSON completo ou fazer alterações retroativas nos registros.
 */
export function resolveProcessoCliente(row: Record<string, any>): string {
  const candidates = [
    row?.cliente, row?.cliente_json, row?.cliente_upper, row?.cliente_title,
    row?.dados?.cliente, row?.dados?.CLIENTE, row?.dados?.Cliente,
  ];
  const found = candidates
    .map((v) => typeof v === 'string' ? v.trim() : '')
    .find((v) => v && !/^(SEM NOME|SEM CLIENTE)$/i.test(v));
  return found || 'SEM NOME';
}
