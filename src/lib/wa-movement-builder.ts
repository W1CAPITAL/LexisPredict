import { createHash } from 'node:crypto';

export type SourceRow = {
  id: number; empresa_id: string; cliente?: string | null; telefone?: string | null;
  protocolo_ref?: string | null; datajud_ultimo_movimento?: string | null;
  datajud_ultimo_nome?: string | null; djen_ultima_data?: string | null;
  djen_ultimo_resumo?: string | null; dados?: Record<string, unknown> | null;
};
export type Alert = {
  empresa_id: string; processo_id: number; protocolo: string; phone: string;
  client_name: string; source: 'DataJud' | 'DJEN'; event_at: string;
  event_hash: string; message: string;
};
const TRUE = new Set(['1','true','sim','s','yes']);
const negative = (v: unknown) => v === false || (typeof v === 'string' && ['false','não','nao','0','no'].includes(v.trim().toLowerCase()));
const affirmative = (v: unknown) => v === true || TRUE.has(String(v ?? '').trim().toLowerCase());
function phoneOf(v: unknown) {
  let digits = String(v || '').replace(/\D/g,'');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}
function eventTime(v: unknown): number {
  if (!v) return 0;
  const raw = String(v).trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= Date.UTC(2000,0,1) && ms < Date.now() + 86400000 ? ms : 0;
}
function normalizedText(v: unknown): string {
  return String(v || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
}
export function prepareMovementAlert(row: SourceRow):
  { alert: Alert | null; reason: 'blocked'|'phone'|'event'|'ok' } {
  const meta = (row.dados && typeof row.dados === 'object') ? row.dados : {};
  const flags = ['nao_contatar','não_contatar','whatsapp_opt_out','optOut','optout','bloquear_whatsapp','naoEnviarWhatsapp'];
  const consent = ['whatsapp_opt_in','consentimento_whatsapp','whatsapp_autorizado'];
  if (flags.some(k => affirmative(meta[k])) || consent.some(k => k in meta && negative(meta[k]))) {
    return { alert: null, reason: 'blocked' };
  }
  const phone = phoneOf(row.telefone || meta.telefone || meta.TELEFONE);
  if (!phone) return { alert: null, reason: 'phone' };
  const datajud = { source: 'DataJud' as const, date: eventTime(row.datajud_ultimo_movimento), text: normalizedText(row.datajud_ultimo_nome) };
  const djen = { source: 'DJEN' as const, date: eventTime(row.djen_ultima_data), text: normalizedText(row.djen_ultimo_resumo) };
  const chosen = [datajud,djen].filter(e => e.date && e.text).sort((a,b) => b.date - a.date)[0];
  const cnj = String(row.protocolo_ref || meta.protocolo || '').trim();
  if (!chosen || !cnj) return { alert: null, reason: 'event' };
  const name = normalizedText(row.cliente || meta.cliente || meta.CLIENTE || 'Cliente').slice(0,100);
  const when = new Date(chosen.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  const message = `Olá, ${name}. Informamos que o processo nº ${cnj} registra a seguinte movimentação em ${when} (fonte: ${chosen.source}):\n\n${chosen.text}\n\nEsta mensagem informa o registro processual e não significa decisão favorável ou desfavorável. Se precisar de esclarecimentos, responda a esta conversa.\nEquipe de acompanhamento processual.`;
  const fingerprint = [row.empresa_id,row.id,chosen.source,chosen.date,chosen.text].join('|');
  return {
    reason: 'ok',
    alert: {
      empresa_id: row.empresa_id, processo_id: Number(row.id), protocolo: cnj,
      phone, client_name: name, source: chosen.source,
      event_at: new Date(chosen.date).toISOString(),
      event_hash: createHash('sha256').update(fingerprint).digest('hex'), message,
    },
  };
}

