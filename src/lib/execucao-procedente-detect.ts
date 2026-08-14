/**
 * Reexporta o módulo executivo (fonte canônica: datajud-sync).
 */
export {
  analisarProcedenciaECumprimento,
} from '@/lib/datajud-sync';

export function prioridadeExecutiva(c: {
  cumprimento_pendente_necessario?: boolean;
  em_cumprimento_sentenca?: boolean;
  is_procedente?: boolean;
}): number {
  if (c.cumprimento_pendente_necessario) return 100;
  if (c.em_cumprimento_sentenca) return 80;
  if (c.is_procedente) return 60;
  return 0;
}
