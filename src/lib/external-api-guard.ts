/**
 * Mensagens honestas e limites de APIs externas — UI e scanner.
 * Não altera flags de telemetria.
 */
export const API_LIMITS_COPY = {
  datajud:
    'DataJud (CNJ) é gratuito e pode atrasar, divergir do PJe/e-SAJ ou retornar 429. Casos críticos: confira no tribunal.',
  djen:
    'DJEN pode retornar 403 (geo) ou 429. Em Vercel, prefira região gru1 (São Paulo).',
  ia:
    'Motores de IA (xAI, Groq, etc.) são opcionais. Scripts locais continuam como 1ª linha.',
  prazo:
    'Prazos CPC são calculados offline (sem API paga). Confirme no calendário do tribunal.',
} as const;

export function messageForExternalError(kind: 'datajud' | 'djen' | 'ia', raw?: string): string {
  const base = API_LIMITS_COPY[kind];
  if (!raw) return base;
  const r = raw.toLowerCase();
  if (r.includes('429') || r.includes('taxa'))
    return `${raw} — reduza o ritmo do lote ou aguarde 1 minuto.`;
  if (r.includes('403') || r.includes('geo'))
    return `${raw} — verifique região do deploy (gru1) e headers.`;
  if (r.includes('timeout') || r.includes('aborted'))
    return `${raw} — tribunal lento; o lote deve seguir sem reiniciar.`;
  return `${raw}`;
}
