/**
 * Extração conservadora de datas de audiências e sessões em atos oficiais.
 * A data de PUBLICAÇÃO ou do movimento DataJud jamais vira data da audiência.
 */
export type AudienciaExtraida = {
  chave: string;
  tipo: 'conciliacao' | 'instrucao' | 'julgamento' | 'sessao_virtual' | 'sessao_julgamento' | 'audiencia';
  data: string | null;
  dataFim: string | null;
  hora: string | null;
  horaFim: string | null;
  fuso: string | null;
  modalidade: 'virtual' | 'presencial' | 'nao_informada';
  situacao: 'publicada' | 'data_pendente' | 'cancelada';
  trecho: string;
};

const meses: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const clean = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dateExpression = /(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})|(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/gi;

function isoDate(day: number, month: number, year: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCDate() !== day || value.getUTCMonth() !== month - 1 || value.getUTCFullYear() !== year) return null;
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
function dates(text: string): Array<{index: number; date: string; raw: string}> {
  const found: Array<{index: number; date: string; raw: string}> = [];
  for (const m of text.matchAll(dateExpression)) {
    const day = Number(m[1] || m[4]);
    const month = m[2] ? Number(m[2]) : meses[clean(m[5] || '')];
    const year = Number(m[3] || m[6]);
    const date = isoDate(day, month, year);
    if (date) found.push({ index: m.index || 0, date, raw: m[0] });
  }
  return found;
}
function clock(text: string, index: number, before = false): string | null {
  const segment = before ? text.slice(Math.max(0, index - 65), index) : text.slice(index, index + 75);
  // "às 13:00", "às 14h00min", "Horário: 09:00", never arbitrary year or CNJ numbers.
  const all = Array.from(segment.matchAll(/(?:às?|hor[aá]rio\s*:\s*|horas?\s*:\s*)\s*(\d{1,2})(?:[:h](\d{2}))?/gi));
  const m = before ? all[all.length - 1] : all[0];
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2] || 0);
  return h < 24 && mm < 60 ? String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0') : null;
}
function eventType(normalized: string): AudienciaExtraida['tipo'] {
  if (/sessao virtual/.test(normalized)) return 'sessao_virtual';
  if (/sessao de julgamento|pauta de julgamento/.test(normalized)) return 'sessao_julgamento';
  if (/concilia|mediac/.test(normalized)) return 'conciliacao';
  if (/instruc/.test(normalized)) return 'instrucao';
  if (/julgamento/.test(normalized)) return 'julgamento';
  return 'audiencia';
}
function build(kind: AudienciaExtraida['tipo'], data: string | null, end: string | null, hora: string | null, horaFim: string | null, segment: string, situacao?: AudienciaExtraida['situacao']): AudienciaExtraida {
  const normalized = clean(segment);
  const fuso = /\b(?:hor[aá]rio\s+(?:de|do)\s+)?(?:MT|MS|AM|AC|RO|SP|Bras[ií]lia)\b/i.exec(segment)?.[0] || null;
  const modalidade = /virtual|videoconfer[eê]ncia|teams|zoom/i.test(segment) ? 'virtual'
    : /presencial/i.test(segment) ? 'presencial' : 'nao_informada';
  return {
    chave: kind + ':' + (data || 'sem-data') + ':' + (end || ''),
    tipo: kind, data, dataFim: end, hora, horaFim, fuso,
    modalidade,
    situacao: situacao || (data ? 'publicada' : 'data_pendente'),
    trecho: segment.replace(/\s+/g,' ').trim().slice(0, 900),
  };
}

/** Retorna somente designações/convocações explícitas, sem inventar data ou horário. */
export function extrairAudienciasOficiais(text: string | null | undefined): AudienciaExtraida[] {
  if (!text || text.length < 15) return [];
  const raw = text.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\r/g,' ');
  const normalized = clean(raw);
  const found: AudienciaExtraida[] = [];
  const dayList = dates(raw);

  // Sessão colegiada virtual tem intervalo; a data final é um compromisso separado da inicial.
  if (/(?:pauta|intimacao|incluido|incluida|sessao virtual|data da sessao).{0,120}(?:sessao|julgamento)|sessao virtual/.test(normalized.slice(0, 350))) {
    const head = raw.slice(0, 1700);
    const normalizedHead = clean(head);
    if (/sessao virtual|sessao de julgamento|data da sessao|pauta de julgamento/.test(normalizedHead)) {
      const sessionDates = dates(head);
      const qualified = /sessao virtual|pauta de sessao|intimacao de pauta|data da sessao/.test(normalizedHead);
      if (qualified && sessionDates.length) {
        // Intervalo explícito publicado pelo DJEN: "Período da sessão:
        // 24/11/2026 00:00 a 01/12/2026 23:59". Precede datas de publicação/prazos.
        const explicitPeriod = /periodo da sessao\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2})\s*(?:as?\s*)?(\d{1,2}:\d{2})?\s*(?:a|ate|–|-)\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2})\s*(?:as?\s*)?(\d{1,2}:\d{2})?/i.exec(normalizedHead);
        const explicitDates = explicitPeriod ? dates(explicitPeriod[0]) : [];
        const start = explicitDates[0] || sessionDates.find((item) => {
          const preceding = clean(head.slice(Math.max(0, item.index - 125), item.index));
          const near = preceding.slice(-100);
          return /\b(?:inicio|iniciara|iniciarao|abertura|comeco)\b/.test(near)
            && !/\b(?:prazo|oposicao|destaque|inscricao|publicacao|manifestacao)\b/.test(near);
        }) || sessionDates[0];
        const end = explicitDates[1] || sessionDates.filter((item) => item.index > start.index).find((item) => {
          if (item.date < start.date) return false;
          const preceding = clean(head.slice(Math.max(start.index, item.index - 175), item.index));
          const near = preceding.slice(-145);
          if (/\b(?:prazo|oposicao|destaque|inscricao|inscricoes|peticionamento|manifestacao|sustentacao|publicacao)\b/.test(near)) return false;
          const definite = /\b(?:termino|terminara|encerramento|fim da sessao|data final da sessao)\b/.test(near);
          const sessionUntil = /\b(?:sessao|julgamento)\b.{0,75}\bate\b/.test(near);
          return definite || sessionUntil;
        }) || null;
        const firstHour = explicitPeriod?.[2] || clock(head, start.index, true) || clock(head, start.index);
        const endHour = explicitPeriod?.[4] || (end ? (clock(head, end.index, true) || clock(head, end.index)) : null);
        found.push(build(/sessao virtual/.test(normalizedHead) ? 'sessao_virtual' : 'sessao_julgamento', start.date, end?.date || null, firstHour, endHour, head, undefined));
      }
    }
  }
  // Uma data de movimentação ou prazo do banco não é uma data de audiência.
  const anchor = /audi[eê]ncia/gi;
  for (const m of raw.matchAll(anchor)) {
    const i = m.index || 0;
    const context = raw.slice(Math.max(0,i - 90), Math.min(raw.length,i + 260));
    const near = clean(context);
    if (/(?:caso|hipotese|eventual|se houver|possibilidade|interesse em|futura)\s.{0,35}audiencia|audiencia.{0,90}(?:a designar|se necessaria|nao sera designada|poder[aá] ser designada|realizada anteriormente)/.test(near)) continue;
    const after = raw.slice(i, i + 230);
    const afterNorm = clean(after);
    const beforeNorm = clean(raw.slice(Math.max(0,i - 85), i));
    const isSet = /(?:designad[ao]|marcad[ao]|agendad[ao]|remarcad[ao]|redesignad[ao]|para\s+o\s+dia|no\s+dia|realizar.se\s+(?:no|em)|realizada?\s+em)/.test(afterNorm)
      || /(?:designo|designa|designar|fic[ao] designad[ao]|intima.{0,25}para|agendad[ao]|marcad[ao])/.test(beforeNorm);
    if (!isSet) continue;
    const targetDate = dayList.find(d => d.index >= i && d.index <= i + 210);
    const cancellation = /(?:cancelad[ao]|desmarcad[ao]|tornada sem efeito|redesignad[ao])/.test(afterNorm.slice(0,175));
    const status = cancellation && !/redesignad[ao].{0,35}para\s+o\s+dia/.test(afterNorm) ? 'cancelada' : undefined;
    // Sem data, guarda pendência de verificação (não entra na agenda como audiência marcada).
    const kind = eventType(near);
    const hour = targetDate ? clock(raw,targetDate.index) || clock(raw,targetDate.index,true) : null;
    found.push(build(kind, targetDate?.date || null, null, hour, null, context, status));
  }
  // Preferir registro com data à pendência, e descartar duplicações da mesma fonte.
  const unique = new Map<string,AudienciaExtraida>();
  for (const ev of found) {
    const prior=unique.get(ev.chave);
    if (!prior || (ev.data && !prior.data)) unique.set(ev.chave,ev);
  }
  return [...unique.values()].filter((ev) => {
    if (ev.tipo !== 'sessao_virtual' && ev.data === null) {
      // Não mostra alerta apenas por texto genérico do DataJud.
      return /\bdesignad[ao]\b|\bdesignar\b|\bdesigno\b|\bmarcad[ao]\b|\bagendad[ao]\b/.test(clean(ev.trecho));
    }
    return true;
  });
}
