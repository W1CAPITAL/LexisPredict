
/** Prevent Omni from being forced onto the Anthropic provider. */
export function normalizeAssistantMotorChoice(value?: string | null): string {
  const chosen = String(value || 'auto').trim().toLowerCase();
  if (!chosen || ['omni', 'auto', 'cascade', 'omniroute'].includes(chosen)) return 'auto';
  if (chosen === 'groq-llama') return 'groq';
  return chosen;
}
