/**
 * Importe no topo de datajud.ts (ou chame no início de cada export):
 *   assertDataJudServerOnly();
 *
 * Impede fetch no browser (CORS no Vercel).
 */
export function assertDataJudServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[DataJud] Proibido no browser (CORS). Use search-actions / server actions / /api/datajud-search.'
    );
  }
}
