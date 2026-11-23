/** A primeira lista deve aparecer rápido; o restante é carregado sob demanda. */
export const FIRST_PROCESSES_PAGE_LIMIT = 30;
const COMPANY_CACHE_STALE_MS = 180_000;

export function shouldRefreshCompanyProcesses(
  lastSuccessAt: number,
  now = Date.now(),
  hasChanges = false,
): boolean {
  return hasChanges || lastSuccessAt <= 0 || now - lastSuccessAt >= COMPANY_CACHE_STALE_MS;
}
