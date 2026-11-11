export type AudienciaExtraida = {
  tipo: string;
  data: string | null;
  dataFim: string | null;
  hora: string | null;
  horaFim: string | null;
  fuso: string | null;
  situacao: "confirmada" | "data_pendente";
  chave: string;
  trecho: string;
};

const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

function clean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(day: number, month: number, year: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dates(text: string): Array<{ value: string; index: number }> {
  const result: Array<{ value: string; index: number }> = [];
  const expression = /(\d{1,2})\s*(?:\/|-|\.|de)\s*([a-z]+|\d{1,2})\s*(?:\/|-|\.|de)\s*(20\d{2})/gi;
  for (const match of text.matchAll(expression)) {
    const day = Number(match[1]);
    const monthToken = clean(match[2]);
    const month = /^\d{1,2}$/.test(monthToken) ? Number(monthToken) : Number(MESES[monthToken] ?? 0);
    const value = isoDate(day, month, Number(match[3]));
    if (value) result.push({ value, index: match.index ?? 0 });
  }
  return result;
}

function clock(text: string, index: number, before = false): string | null {
  const segment = before
    ? text.slice(Math.max(0, index - 75), index)
    : text.slice(index, index + 75);
  const matches = [...segment.matchAll(/(?:às?|as)?\s*(\d{1,2})[:h](\d{2})\s*(?:h|horas?)?/gi)];
  const match = before ? matches[matches.length - 1] : matches[0];
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseDateToken(value: string): string | null {
  const match = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})$/.exec(value.trim());
  return match ? isoDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

function parseClockToken(value: string): string | null {
  const match = /^(\d{1,2})[:h](\d{2})$/i.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseSessionPeriod(text: string): {
  startDate: string;
  startTime: string | null;
  endDate: string;
  endTime: string | null;
  index: number;
} | null {
  const expression = /periodo\s+da\s+sessao\s*[:=-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2})\s*(?:as?\s*)?(\d{1,2}[:h]\d{2})\s*(?:a|ate|[-–—])\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2})\s*(?:as?\s*)?(\d{1,2}[:h]\d{2})/i;
  const match = expression.exec(text);
  if (!match) return null;
  const startDate = parseDateToken(match[1]);
  const endDate = parseDateToken(match[3]);
  if (!startDate || !endDate || endDate < startDate) return null;
  return {
    startDate,
    startTime: parseClockToken(match[2]),
    endDate,
    endTime: parseClockToken(match[4]),
    index: match.index,
  };
}

function excerptAround(text: string, index: number, maxLength = 900): string {
  if (text.length <= maxLength) return text;
  const start = Math.max(0, Math.min(index - 360, text.length - maxLength));
  return text.slice(start, start + maxLength);
}

function eventType(text: string): string {
  if (/sessao virtual/.test(text)) return "sessao_virtual";
  if (/audiencia de instrucao/.test(text)) return "instrucao";
  if (/audiencia de conciliacao|conciliacao/.test(text)) return "conciliacao";
  if (/audiencia/.test(text)) return "audiencia";
  if (/julgamento|pauta/.test(text)) return "julgamento";
  return "data_pendente";
}

function build(
  kind: string,
  data: string | null,
  dataFim: string | null,
  hora: string | null,
  horaFim: string | null,
  segment: string,
  situacao: "confirmada" | "data_pendente" = "confirmada",
  fusoSource = segment,
): AudienciaExtraida {
  const explicitFuso = /(?:fuso|hor[aá]rio(?:\s+local)?|hor[aá]rio\s+de\s+refer[eê]ncia)\s*(?:de|do|:|=)?\s*(America\/[A-Za-z_]+|Bras[ií]lia|AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)/i.exec(fusoSource);
  const parentheticalFuso = /\((AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\)/i.exec(fusoSource);
  const brasiliaFuso = /\bBras[ií]lia\b/i.exec(fusoSource);
  const fuso = explicitFuso?.[1] ?? parentheticalFuso?.[1] ?? (brasiliaFuso ? "Brasília" : null);
  return {
    tipo: kind,
    data,
    dataFim,
    hora,
    horaFim,
    fuso,
    situacao,
    // A identidade do evento não depende da data final: o DJEN pode publicar
    // primeiro o início e só depois disponibilizar o período completo.
    chave: `${kind}:${data ?? "sem-data"}:${hora ?? ""}`,
    trecho: segment.slice(0, 900),
  };
}

export function extrairAudienciasOficiais(text: string): AudienciaExtraida[] {
  const raw = String(text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const normalized = clean(raw);
  if (!normalized) return [];

  const found: AudienciaExtraida[] = [];
  const head = raw.slice(0, 12000);
  const normalizedHead = clean(head);
  const sessionCandidate = /(?:pauta|intimacao|incluido|incluida|sessao virtual|data da sessao).{0,180}(?:sessao|julgamento)|sessao virtual/.test(normalized.slice(0, 12000));

  if (sessionCandidate) {
    const kind = eventType(normalizedHead);
    const period = parseSessionPeriod(normalized);
    if (period) {
      found.push(build(
        kind,
        period.startDate,
        period.endDate,
        period.startTime,
        period.endTime,
        excerptAround(raw, period.index),
        "confirmada",
        raw,
      ));
    } else {
      const sessionDates = dates(head);
      const start = sessionDates.find((item) => /inicio|a partir|comeco/.test(normalizedHead.slice(Math.max(0, item.index - 75), item.index))) ?? sessionDates[0];
      const end = start
        ? sessionDates.find((item) => item.index > start.index && /termino|encerramento|fim|ate|a\s+\d/.test(normalizedHead.slice(Math.max(0, item.index - 75), item.index)))
          ?? (/(periodo|de\s+.*\s+a\s+\d|ate\s+\d)/.test(normalizedHead.slice(start.index, start.index + 180))
            ? sessionDates.find((item) => item.index > start.index)
            : undefined)
        : undefined;
      if (start) {
        const startClock = clock(head, start.index) ?? clock(head, start.index, true);
        const endClock = end ? clock(head, end.index) ?? clock(head, end.index, true) : null;
        found.push(build(
          kind,
          start.value,
          end?.value ?? null,
          startClock,
          endClock,
          head,
          "confirmada",
          raw,
        ));
      } else {
        found.push(build(kind, null, null, null, null, head, "data_pendente", raw));
      }
    }
  }

  const anchors = [...normalizedHead.matchAll(/\b(audiencia|julgamento|sessao)\b/g)];
  for (const anchor of anchors) {
    const index = anchor.index ?? 0;
    const near = normalizedHead.slice(Math.max(0, index - 110), Math.min(normalizedHead.length, index + 210));
    const kind = eventType(near);
    const date = dates(near)[0];
    if (!date || kind === "data_pendente") continue;
    const hour = clock(near, date.index) ?? clock(near, date.index, true);
    found.push(build(kind, date.value, null, hour, null, near, "confirmada", raw));
  }

  const unique = new Map<string, AudienciaExtraida>();
  for (const event of found) {
    const previous = unique.get(event.chave);
    if (!previous || (event.dataFim && !previous.dataFim) || (event.horaFim && !previous.horaFim)) {
      unique.set(event.chave, event);
    }
  }
  return [...unique.values()];
}
