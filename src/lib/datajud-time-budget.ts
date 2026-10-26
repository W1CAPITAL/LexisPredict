/** Tempo compatível com o resultado real da API pública: TJMS respondeu em
 * aproximadamente 26 segundos durante verificação oficial em 26/10/2026.
 * O scanner cloud tem timeout HTTP de 55s e roda 1 CNJ por micro-lote.
 * Onze segundos causavam falsos negativos "DataJud: não confirmado".
 */
export const DATAJUD_CLOUD_TIMEOUT_MS = 32_000;
export function resolveDataJudTimeoutMs(options:{cloudBudget?:boolean;fast?:boolean} = {}):number {
 if(options.cloudBudget)return DATAJUD_CLOUD_TIMEOUT_MS;
 return options.fast ? 32_000 : 42_000;
}
