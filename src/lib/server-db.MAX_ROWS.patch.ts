// Aplique esta linha em getStoredCasesForEmpresa (src/lib/server-db.ts):
  // ANTES: 2000 cortava carteiras grandes (UI mostrava 2000 "redondo").
  // Admin/empresa-wide: até 12k. Operador continua no mesmo fluxo com filtro mine.
  const MAX_ROWS = 12000;
