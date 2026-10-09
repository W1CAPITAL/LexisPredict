import { prepareDailyReturn, type ReturnCase } from '@/lib/wa-daily-return-policy';

export type SourceRow = ReturnCase;
export type Alert = {
  empresa_id: string; processo_id: number; protocolo: string; phone: string;
  client_name: string; source: 'DataJud' | 'DJEN'; event_at: string;
  event_hash: string; message: string;
};

/** Both scanner and portfolio queues use the same last-return cutoff. */
export function prepareMovementAlert(row: SourceRow, consentAttested = false) {
  const result = prepareDailyReturn(row, {mode:'single', consentAttested});
  const notice = result.ready;
  if (!notice) return {alert:null, reason:result.reason};
  return {reason:'ok' as const, alert:{
    empresa_id:notice.empresaId, processo_id:notice.processoId, protocolo:notice.cnj,
    phone:notice.phone, client_name:notice.name, source:notice.source,
    event_at:notice.eventAt, event_hash:notice.eventHash, message:notice.message,
  } satisfies Alert};
}
