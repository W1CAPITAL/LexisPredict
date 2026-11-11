/** Orçamento de tempo do DataJud para Hermes.
 * Cron: janela curta para não acumular execuções.
 * Clique manual: mais tempo para índices lentos, mas sem repetição em 429.
 * A consulta continua sujeita ao circuit breaker por tribunal.
 */
export function resolveHermesDataJudTimeoutMs(manual:boolean,probeTimeoutMs?:number):number{
 const preferred=manual?85_000:38_000;
 if(typeof probeTimeoutMs!=='number'||!Number.isFinite(probeTimeoutMs)||probeTimeoutMs<=0)return preferred;
 return Math.max(5_000,Math.min(90_000,Math.round(probeTimeoutMs)));
}
