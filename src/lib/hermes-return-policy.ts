/**
 * Hermes Return Intelligence — deterministic recommendations from verified
 * DJEN, DataJud and authorized tribunal MNI snapshots. No LLM, no outbound message, no appointment write.
 */
import { isCasoEncerrado } from '@/lib/status-encerrado';
import { validReturnDay } from '@/lib/wa-daily-return-policy';

export type HermesCourtEvent = {
  source: 'DJEN' | 'DataJud' | 'TJPR PROJUDI';
  at: string;
  text: string;
  url: string | null;
};
export type HermesCourtSnapshot = {
  djenOk: boolean;
  datajudOk: boolean;
  datajudUpdatedAt?: string | null;
  datajudIndexTimestamp?: string | null;
  events: HermesCourtEvent[];
  courtApiOk?: boolean;
  courtApiAttempted?: boolean;
  courtApiSource?: string;
  courtApiError?: string | null;
};
export type HermesReturnHighlight = {
  source: 'DJEN' | 'DataJud' | 'TJPR PROJUDI' | 'Sistema';
  date: string | null;
  text: string;
  kind: 'new' | 'gap' | 'context';
  url: string | null;
};
export type HermesReturnResult = {
  state: 'ready' | 'partial' | 'unavailable' | 'skipped';
  priorityScore: number;
  priorityLabel: 'Crítica' | 'Alta' | 'Normal' | 'Não aplicável';
  highlights: HermesReturnHighlight[];
  messageDraft: string | null;
  suggestedNextReturn: string | null;
  djenOk: boolean;
  datajudOk: boolean;
  courtApiOk: boolean;
};
type Input = {
  cliente?: string | null;
  protocolo?: string | null;
  ultimoRetorno?: string | null;
  proximoRetorno?: string | null;
  status?: string | null;
  today: string;
};

const concise = (v: unknown, max = 500) =>
  String(v || '').replace(/<[^>]*>/g, ' ').replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);

const dateLabel = (iso: string) => {
  const d = validReturnDay(iso);
  return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : iso;
};
const nextDay = (today: string, days: number) => {
  const value = new Date(today + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const validEventDay = (event: HermesCourtEvent) => validReturnDay(event.at);
const isCritical = (text: string) => /intima[cç][aã]o|intimad[oa]|prazo|audi[eê]ncia|custas|penhora|bloqueio|revelia|senten[cç]a|cumprimento|decis[aã]o|determino|despacho|tr[aâ]nsito em julgado/i.test(text);

export function buildHermesReturnReview(input: Input, snapshot: HermesCourtSnapshot): HermesReturnResult {
  const empty: HermesReturnResult = {
    state: 'unavailable', priorityScore: 0, priorityLabel: 'Não aplicável',
    highlights: [], messageDraft: null, suggestedNextReturn: null,
    djenOk: !!snapshot.djenOk, datajudOk: !!snapshot.datajudOk, courtApiOk: snapshot.courtApiOk===true,
  };
  if (isCasoEncerrado({ status_interno: input.status })) {
    return { ...empty, state: 'skipped', highlights: [
      { source: 'Sistema', date: null, text: 'Processo marcado como encerrado no cadastro; retorno automático não preparado.', kind: 'context', url: null },
    ] };
  }
  const last = validReturnDay(input.ultimoRetorno);
  const today = validReturnDay(input.today);
  if (!today) return { ...empty, highlights: [{ source: 'Sistema', date: null, text: 'Data da consulta inválida.', kind: 'gap', url: null }] };

  const daysLate = input.proximoRetorno && validReturnDay(input.proximoRetorno)
    ? Math.max(0, Math.floor((Date.parse(today + 'T12:00:00Z') - Date.parse(validReturnDay(input.proximoRetorno)! + 'T12:00:00Z')) / 86400000))
    : 0;

  const sorted = snapshot.events.filter((event) => {
    const sourceOk = event.source === 'DJEN' ? snapshot.djenOk
      : event.source === 'DataJud' ? snapshot.datajudOk : snapshot.courtApiOk === true;
    return sourceOk && !!concise(event.text) && !!validEventDay(event) && validEventDay(event)! <= today;
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const newer = last ? sorted.filter((event) => validEventDay(event)! > last) : [];
  const highlights: HermesReturnHighlight[] = newer.slice(0, 3).map((event) => ({
    source: event.source, date: validEventDay(event),
    text: concise(event.text), kind: 'new' as const,
    url: event.url && /^https:\/\//i.test(event.url) ? event.url : null,
  }));
  if (!last) highlights.push({ source: 'Sistema', date: null, kind: 'gap', url: null,
    text: 'Último retorno ausente: confira o histórico antes de declarar uma movimentação como nova.' });
  if (!snapshot.djenOk) highlights.push({ source: 'DJEN', date: null, kind: 'gap', url: null, text: 'Consulta DJEN indisponível ou sem confirmação nesta execução.' });
  if (!snapshot.datajudOk) highlights.push({ source: 'DataJud', date: null, kind: 'gap', url: null, text: 'Consulta DataJud indisponível ou sem confirmação nesta execução.' });
  if (snapshot.courtApiAttempted && !snapshot.courtApiOk) highlights.push({
    source: 'TJPR PROJUDI', date: null, kind: 'gap', url: null,
    text: concise(snapshot.courtApiError || 'Consulta MNI do TJPR não confirmada; verifique a configuração da integração oficial.'),
  });
  if (snapshot.courtApiOk) highlights.push({
    source: 'TJPR PROJUDI', date: today, kind: 'context', url: null,
    text: 'Consulta direta ao serviço oficial MNI do PROJUDI/TJPR confirmada.',
  });
  const movementSourceOk = snapshot.datajudOk || snapshot.courtApiOk === true;
  if (!newer.length && last && snapshot.djenOk && movementSourceOk) highlights.push({
    source: 'Sistema', date: today, kind: 'context', url: null,
    text: 'Nas consultas desta execução, não foi identificado registro posterior ao último retorno de ' + dateLabel(last) + '.',
  });
  const urgent = newer.some((event) => isCritical(event.text));
  const state = snapshot.djenOk && movementSourceOk ? 'ready' : snapshot.djenOk || movementSourceOk ? 'partial' : 'unavailable';
  const priorityScore = urgent ? 96 : newer.length ? 81 : state !== 'ready' ? 78 : Math.min(79, 58 + Math.min(daysLate, 21));
  const priorityLabel = priorityScore >= 90 ? 'Crítica' : priorityScore >= 75 ? 'Alta' : 'Normal';
  const first = concise(input.cliente, 120).split(/\s+/)[0] || '';
  const name = first ? first.charAt(0).toUpperCase() + first.slice(1).toLocaleLowerCase('pt-BR') : '';
  const greeting = 'Olá' + (name ? ', ' + name : '') + '!';
  let messageDraft: string | null = null;
  if (newer.length) {
    const event = newer[0];
    messageDraft = greeting + ' Sobre seu processo ' + concise(input.protocolo, 35) + ', consultamos o ' + event.source + ' e identificamos um registro de ' + dateLabel(validEventDay(event)!) + ': "' + concise(event.text, 220) + '". Seguimos acompanhando o processo e informaremos novas atualizações confirmadas.';
  } else if (snapshot.djenOk && movementSourceOk && last) {
    const movementSources = [snapshot.datajudOk ? 'DataJud' : null, snapshot.courtApiOk ? (snapshot.courtApiSource || 'TJPR PROJUDI') : null].filter(Boolean);
    const consulted = ['DJEN', ...movementSources].join(' e ');
    messageDraft = greeting + ' Realizamos novas consultas ao ' + consulted + ' em ' + dateLabel(today) + '. Nas consultas realizadas, não identificamos registro posterior ao último retorno de ' + dateLabel(last) + '. Seguimos acompanhando seu processo.';
  } else {
    // Source failure without a new verified event is not enough to draft a judicial update.
    messageDraft = null;
  }
  return { state, priorityScore, priorityLabel, highlights,
    messageDraft, suggestedNextReturn: nextDay(today, urgent ? 25 : 30),
    djenOk: !!snapshot.djenOk, datajudOk: !!snapshot.datajudOk, courtApiOk: snapshot.courtApiOk===true };
}
