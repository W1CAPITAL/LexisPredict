export type AudienciaExpiryInput = {
  data?: string | null;
  dataFim?: string | null;
  horaFim?: string | null;
  fuso?: string | null;
  tribunal?: string | null;
};

const TIME_ZONE_BY_UF: Record<string, string> = {
  AC: "America/Rio_Branco",
  AL: "America/Maceio",
  AM: "America/Manaus",
  AP: "America/Belem",
  BA: "America/Bahia",
  CE: "America/Fortaleza",
  DF: "America/Sao_Paulo",
  ES: "America/Sao_Paulo",
  GO: "America/Sao_Paulo",
  MA: "America/Fortaleza",
  MG: "America/Sao_Paulo",
  MS: "America/Campo_Grande",
  MT: "America/Cuiaba",
  PA: "America/Belem",
  PB: "America/Fortaleza",
  PE: "America/Recife",
  PI: "America/Fortaleza",
  PR: "America/Sao_Paulo",
  RJ: "America/Sao_Paulo",
  RN: "America/Fortaleza",
  RO: "America/Porto_Velho",
  RR: "America/Boa_Vista",
  RS: "America/Sao_Paulo",
  SC: "America/Sao_Paulo",
  SE: "America/Maceio",
  SP: "America/Sao_Paulo",
  TO: "America/Araguaina",
};

const TRT_UF: Record<string, string> = {
  TRT1: "RJ", TRT2: "SP", TRT3: "MG", TRT4: "RS", TRT5: "BA", TRT6: "PE",
  TRT7: "CE", TRT8: "PA", TRT9: "PR", TRT10: "DF", TRT12: "SC", TRT13: "PB",
  TRT15: "SP", TRT16: "MA", TRT17: "ES", TRT18: "GO", TRT19: "AL", TRT20: "SE",
  TRT21: "RN", TRT22: "PI", TRT23: "MT", TRT24: "MS",
};

function validDay(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  return `${match[3]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

function validClock(value?: string | null): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeToken(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(fuso?: string | null, tribunal?: string | null): string | null {
  const rawFuso = String(fuso ?? "").trim();
  if (rawFuso.startsWith("America/") && isValidTimeZone(rawFuso)) return rawFuso;

  const fusoToken = normalizeToken(rawFuso).replace(/[^A-Z]/g, "");
  if (fusoToken.includes("BRASILIA")) return "America/Sao_Paulo";
  if (TIME_ZONE_BY_UF[fusoToken]) return TIME_ZONE_BY_UF[fusoToken];

  const court = normalizeToken(String(tribunal ?? "")).replace(/[^A-Z0-9]/g, "");
  const tj = /^TJ([A-Z]{2})/.exec(court);
  const trt = /^(TRT\d{1,2})/.exec(court);
  const uf = tj?.[1] ?? (trt ? TRT_UF[trt[1]] : undefined);
  return uf ? TIME_ZONE_BY_UF[uf] ?? null : null;
}

function localParts(now: Date, timeZone: string): { day: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    clock: `${values.hour}:${values.minute}`,
  };
}

export function isAudienciaExpirada(event: AudienciaExpiryInput, now = new Date()): boolean {
  const endDay = validDay(event.dataFim) ?? validDay(event.data);
  const endTime = validClock(event.horaFim);
  const timeZone = resolveTimeZone(event.fuso, event.tribunal);
  // Sem fuso confirmado, não apagamos um evento do mesmo dia por suposição.
  if (!endDay || !timeZone) return false;

  const local = localParts(now, timeZone);
  if (endDay < local.day) return true;
  if (endDay > local.day || !endTime) return false;
  // Só expira depois do minuto final, nunca no instante exato indicado.
  return endTime < local.clock;
}

export function filtrarAudienciasVigentes<T extends AudienciaExpiryInput>(
  events: readonly T[],
  now = new Date(),
  context: Pick<AudienciaExpiryInput, "fuso" | "tribunal"> = {},
): T[] {
  return events.filter((event) => !isAudienciaExpirada({ ...context, ...event }, now));
}
