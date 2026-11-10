/** Identidade de recorrência de tarefas do CRM: mesma empresa + mesmo negócio/cliente + mesmo título. */
export function normalizeRecurringTaskTitle(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR').slice(0, 180);
}
