/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @fileOverview Helper de UI Responsiva para LexisPredict Authority.
 */

export const BP = { md: 768, lg: 1024, xl: 1280 } as const;

/** Classes prontas para cn() - Mapeamento para o motor lexis-responsive.css */
export const ui = {
  main: 'lexis-main-scroll',
  readable: 'lexis-readable',
  label: 'lexis-label-xs',
  touch: 'lexis-touch',
  stack: 'lexis-stack lexis-stack-md-row',
  metrics: 'lexis-grid-metrics',
  metrics5: 'lexis-grid-metrics lexis-grid-metrics-5',
  dialogBody: 'lexis-dialog-body',
  tableWrap: 'lexis-table-wrap',
  cnj: 'lexis-cnj',
  scanner: 'lexis-scanner-float',
} as const;
