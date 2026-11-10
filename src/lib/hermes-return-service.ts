import 'server-only';
import { getSupabaseAdmin } from '@/lib/server-db';
import { fetchDataJud } from '@/lib/datajud';
import { fetchDjenComunicacoes, resolveDjenPublicacaoLink } from '@/lib/djen';
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { brazilToday, validReturnDay } from '@/lib/wa-daily-return-policy';
import { buildHermesReturnReview, type HermesCourtEvent, type HermesCourtSnapshot } from '@/lib/hermes-return-policy';

type ProcessRow = {
  id: number; empresa_id: string; cliente: string | null; protocolo_ref: string | null;
  ultimo_retorno: string | null; proximo_retorno: string | null;
  status_interno: string | null; status: string | null;
  dados: Record<string, unknown> | null;
};
type Claim = { empresa_id: string; processo_id: number; due_on: string };

function normalizedCnj(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length === 20 ? digits : '';
}
function eventDate(value: unknown): string {
  const raw = String(value || '');
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return '';
  return /T\d\d:\d\d/.test(raw) ? brazilToday(new Date(parsed)) : (validReturnDay(raw) || '');
}
function safeLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'comunica.pje.jus.br' || url.hostname.endsWith('.jus.br')) ? url.href : null;
  } catch { return null; }
}
export async function loadHermesReviewCase(db: Awaited<ReturnType<typeof getSupabaseAdmin>>, empresaId: string, processId: number) {
  const { data, error } = await db.from('processos')
    .select('id,empresa_id,cliente,protocolo_ref,ultimo_retorno,proximo_retorno,status_interno,status,dados')
    .eq('empresa_id', empresaId).eq('id', processId).maybeSingle();
  if (error) throw new Error('Falha ao consultar processo do tenant.');
  return (data || null) as ProcessRow | null;
}

/** Independent court verification: no WhatsApp queue and no changes to process or return dates. */
async function obtainCourtSnapshot(cnj: string, lastReturn: string | null): Promise<HermesCourtSnapshot> {
  const fromDay = validReturnDay(lastReturn);
  const beginning = fromDay
    ? new Date(Date.parse(fromDay + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const [dj, djen] = await Promise.allSettled([
    fetchDataJud(cnj, 1, { fast: true, cloudBudget: true }),
    fetchDjenComunicacoes(cnj, { dataInicio: beginning, cloudBudget: true }),
  ]);
  const datajud = dj.status === 'fulfilled' ? dj.value : null;
  const diario = djen.status === 'fulfilled' ? djen.value : null;
  const datajudOk = !!datajud && datajud.error === false && datajud.found === true;
  const djenOk = !!diario && diario.success === true;
  const events: HermesCourtEvent[] = [];
  if (datajudOk) {
    const movements = Array.isArray(datajud.movimentos) ? datajud.movimentos : [];
    for (const movement of movements) {
      const at = eventDate(movement?.dataHora || movement?.data || movement?.dataMovimento);
      const text = String(movement?.nome || movement?.descricao || '').trim();
      if (at && text) events.push({ source: 'DataJud', at, text, url: null });
    }
  }
  if (djenOk) {
    for (const item of diario!.items || []) {
      if (normalizedCnj(item.numero_processo) !== cnj) continue;
      const at = validReturnDay(item.data_disponibilizacao);
      const text = String(item.texto || '').trim();
      if (!at || !text) continue;
      events.push({
        source: 'DJEN', at, text,
        url: safeLink(resolveDjenPublicacaoLink(item, cnj)),
      });
    }
  }
  return { djenOk, datajudOk, events };
}
async function persistResult(
  db: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  row: ProcessRow, due: string,
  result: ReturnType<typeof buildHermesReturnReview>, cnj: string,
) {
  const now = new Date().toISOString();
  const { error } = await db.from('hermes_return_reviews').upsert({
    empresa_id: row.empresa_id, processo_id: row.id, due_on: due,
    state: result.state, checked_at: now, attempted_at: now,
    djen_ok: result.djenOk, datajud_ok: result.datajudOk,
    priority_score: result.priorityScore, priority_label: result.priorityLabel,
    highlights: result.highlights, message_draft: result.messageDraft,
    suggested_next_return: result.suggestedNextReturn,
    source_snapshot: {
      cnj, checkedAt: now,
      djen: result.djenOk ? 'consultado' : 'indisponivel',
      datajud: result.datajudOk ? 'consultado' : 'indisponivel',
      origin: 'official-public-apis',
    },
  }, { onConflict: 'empresa_id,processo_id,due_on' });
  if (error) throw new Error('Falha ao registrar revisão judicial: ' + error.message);
}

/** Scheduler supplies a claimed (tenant,process,scheduled day); manual action also uses this path. */
export async function reviewHermesCase(input: {
  empresaId: string; processId: number; dueOn?: string;
}) {
  const db = await getSupabaseAdmin();
  const row = await loadHermesReviewCase(db, input.empresaId, input.processId);
  if (!row) return { ok: false as const, reason: 'not_found' };
  const today = brazilToday();
  // Manual early checks must not satisfy the future scheduled return claim.
  // A due/overdue manual check may reuse the current scheduled date.
  const scheduled = validReturnDay(row.proximo_retorno);
  const due = validReturnDay(input.dueOn) ||
    (scheduled && scheduled <= today ? scheduled : today);
  const cnj = normalizedCnj(row.protocolo_ref || row.dados?.protocolo);
  const name = row.cliente || String(row.dados?.cliente || '');
  let snapshot: HermesCourtSnapshot = { djenOk: false, datajudOk: false, events: [] };
  if (cnj && !isCasoEncerrado(row)) snapshot = await obtainCourtSnapshot(cnj, row.ultimo_retorno);
  const result = buildHermesReturnReview({
    cliente: name, protocolo: row.protocolo_ref || cnj,
    ultimoRetorno: row.ultimo_retorno, proximoRetorno: row.proximo_retorno,
    status: isCasoEncerrado(row) ? 'ENCERRADO' : String(row.status_interno || row.status || ''),
    today,
  }, snapshot);
  if (!cnj && result.state !== 'skipped') {
    result.state = 'unavailable';
    result.messageDraft = null;
    result.highlights.unshift({
      source: 'Sistema', date: null, text: 'CNJ inválido ou ausente: não foi possível consultar as fontes oficiais.',
      kind: 'gap', url: null,
    });
  }
  await persistResult(db, row, due, result, cnj);
  return { ok: true as const, processId: row.id, state: result.state, score: result.priorityScore };
}

/** Incremental microbatch; called by authenticated server scheduler, never sends messages. */
export async function runHermesDueReviewBatch(maxCases = 2) {
  const started = Date.now();
  const db = await getSupabaseAdmin();
  const today = brazilToday();
  const results: Array<{ processId: number; state: string }> = [];
  for (let index = 0; index < Math.min(3, Math.max(1, maxCases)); index++) {
    if (Date.now() - started > 34000) break;
    const { data, error } = await db.rpc('hermes_claim_due_review', { p_today: today });
    if (error) throw new Error('Não foi possível selecionar processos vencidos para consulta.');
    const claim = ((data || []) as Claim[])[0];
    if (!claim) break;
    try {
      const reviewed = await reviewHermesCase({
        empresaId: claim.empresa_id, processId: Number(claim.processo_id), dueOn: claim.due_on,
      });
      results.push({ processId: Number(claim.processo_id), state: reviewed.ok ? reviewed.state : 'unavailable' });
      if (!reviewed.ok) {
        await db.from('hermes_return_reviews').update({ state: 'unavailable', checked_at: new Date().toISOString() })
          .eq('empresa_id', claim.empresa_id).eq('processo_id', claim.processo_id).eq('due_on', claim.due_on);
      }
    } catch {
      await db.from('hermes_return_reviews').update({ state: 'unavailable', checked_at: new Date().toISOString() })
        .eq('empresa_id', claim.empresa_id).eq('processo_id', claim.processo_id).eq('due_on', claim.due_on);
      results.push({ processId: Number(claim.processo_id), state: 'unavailable' });
    }
  }
  return { ok: true, processed: results.length, results, elapsedMs: Date.now() - started };
}
