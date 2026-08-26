/**
 * Ponte LexisPredict ↔ Legalcloud
 *
 * Legalcloud (legalcloud.com.br) NÃO oferece API pública de liquidação.
 * Repositórios em github.com/Legalcloud/* são forks genéricos (JWT, Vue card, NDK),
 * não o produto de cálculo.
 *
 * Estratégia:
 * 1) Motor próprio (`liquidacao-cumprimento.ts`) no fluxo Lexis.
 * 2) Deep-link / handoff para a calculadora Premium do operador.
 * 3) Payload JSON exportável para colar/reproduzir no Legalcloud.
 */

export const LEGALCLOUD_URLS = {
  home: 'https://legalcloud.com.br/',
  calculadoraLiquidacao: 'https://legalcloud.com.br/calculadora-liquidacao-civel/',
  app: 'https://app.legalcloud.com.br/',
  suporteCalc:
    'https://legalcloud.crisp.help/pt-br/article/tudo-o-que-voce-precisa-saber-calculadora-de-cumprimento-de-sentenca-e-liquidacao-civel-elyc0z/',
} as const;

export type HandoffLegalcloud = {
  protocolo?: string;
  cliente?: string;
  valorPrincipal?: number | null;
  dataBase?: string | null;
  honorariosPct?: number | null;
  aplicarArt523?: boolean;
  observacoes?: string;
  geradoEm: string;
  origem: 'LexisPredict';
};

export function buildHandoffLegalcloud(partial: Omit<HandoffLegalcloud, 'geradoEm' | 'origem'>): HandoffLegalcloud {
  return {
    ...partial,
    geradoEm: new Date().toISOString(),
    origem: 'LexisPredict',
  };
}

export function handoffToClipboardText(h: HandoffLegalcloud): string {
  const lines = [
    '=== Handoff LexisPredict → Legalcloud (Liquidação Cível) ===',
    h.protocolo ? `CNJ: ${h.protocolo}` : null,
    h.cliente ? `Cliente: ${h.cliente}` : null,
    h.valorPrincipal != null ? `Principal (referência): ${h.valorPrincipal}` : 'Principal: (preencher no Legalcloud)',
    h.dataBase ? `Data-base: ${h.dataBase}` : null,
    h.honorariosPct != null ? `Hon. conhecimento %: ${h.honorariosPct}` : null,
    h.aplicarArt523 != null ? `Art. 523: ${h.aplicarArt523 ? 'sim' : 'não'}` : null,
    h.observacoes ? `Obs: ${h.observacoes}` : null,
    `Gerado: ${h.geradoEm}`,
    '',
    'Abra: ' + LEGALCLOUD_URLS.calculadoraLiquidacao,
    'Confirme índices oficiais (IPCA/SELIC/Taxa Legal) no Legalcloud Premium.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** URL da calculadora (sem query params oficiais — produto não documenta deep-link). */
export function urlCalculadoraLegalcloud(): string {
  return LEGALCLOUD_URLS.calculadoraLiquidacao;
}
