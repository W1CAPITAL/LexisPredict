/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Telemetria de scan + log de alertas
 */
import { getTelemetryWriteClient } from '@/lib/dual-db-routing';

export async function logScanMetric(opts: {
  empresaId: string;
  source: 'datajud' | 'djen';
  success: boolean;
  protocolo?: string;
  errorCode?: string;
  latencyMs?: number;
}) {
  try {
    const admin = getTelemetryWriteClient(crypto.randomUUID()).client;
    const { error } = await admin.from('scan_metrics').insert({
      empresa_id: opts.empresaId,
      source: opts.source,
      success: opts.success,
      error_code: opts.errorCode || null,
      protocolo_ref: opts.protocolo || null,
      latency_ms: opts.latencyMs ?? null,
    });
    if (error) console.error('[scan_metrics] gravação não confirmada:', error.message);
  } catch (e) {
    console.error('[scan_metrics]', e);
  }
}

export async function logAlertEvent(opts: {
  empresaId: string;
  protocolo: string;
  eventType: 'raised' | 'persisted' | 'cleared' | 'acked';
  source?: string;
  payload?: Record<string, any>;
}) {
  try {
    const admin = getTelemetryWriteClient(crypto.randomUUID()).client;
    const { error } = await admin.from('alert_events').insert({
      empresa_id: opts.empresaId,
      protocolo_ref: opts.protocolo,
      event_type: opts.eventType,
      source: opts.source || null,
      payload: opts.payload || {},
    });
    if (error) console.error('[alert_events] gravação não confirmada:', error.message);
  } catch (e) {
    console.error('[alert_events]', e);
  }
}
