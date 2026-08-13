/**
 * Anti-ban para Evolution / Baileys (uso seguro, sem garantia Meta).
 * - Delay aleatório + typing proporcional ao texto
 * - Gap mínimo entre envios
 * - Teto diário por instância (memória do processo; multi-réplica = somar limites)
 * - Detecta mensagem idêntica em sequência (spam pattern)
 *
 * Env opcionais:
 *   WA_ANTIBAN_MIN_MS=8000
 *   WA_ANTIBAN_MAX_MS=35000
 *   WA_ANTIBAN_GAP_MS=12000
 *   WA_ANTIBAN_DAILY_MAX=120
 *   WA_ANTIBAN_NEW_NUMBER_DAILY_MAX=40
 */

type WindowState = {
  dayKey: string;
  count: number;
  lastSentAt: number;
  lastHash: string;
  lastHashCount: number;
};

const g = globalThis as unknown as { __lexisWaAntiBan?: WindowState };
function state(): WindowState {
  const dayKey = new Date().toISOString().slice(0, 10);
  if (!g.__lexisWaAntiBan || g.__lexisWaAntiBan.dayKey !== dayKey) {
    g.__lexisWaAntiBan = {
      dayKey,
      count: 0,
      lastSentAt: 0,
      lastHash: '',
      lastHashCount: 0,
    };
  }
  return g.__lexisWaAntiBan;
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function simpleHash(s: string): string {
  let h = 0;
  const t = s.trim().toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return String(h);
}

/** Delay de “digitação” + jitter humano (ms). */
export function humanTypingDelayMs(text: string): number {
  const min = envInt('WA_ANTIBAN_MIN_MS', 8000);
  const max = envInt('WA_ANTIBAN_MAX_MS', 35000);
  const len = String(text || '').length;
  // ~35–55 ms por caractere, limitado
  const byLen = Math.min(18000, Math.max(2500, Math.round(len * (40 + Math.random() * 20))));
  const jitter = min + Math.floor(Math.random() * Math.max(1, max - min));
  return Math.min(max, Math.max(min, Math.round((byLen + jitter) / 2)));
}

/** Delay que a Evolution usa em `options.delay` (presença composing). */
export function evolutionPresenceDelayMs(text: string): number {
  const t = humanTypingDelayMs(text);
  // Evolution delay costuma ser menor que o sleep total; fracionamos
  return Math.min(12000, Math.max(900, Math.round(t * 0.45)));
}

export type AntibanGateResult =
  | { ok: true; waitMs: number; reason?: string }
  | { ok: false; error: string; waitMs?: number };

/**
 * Verifica teto diário, gap e spam de texto idêntico.
 * Se ok, devolve quanto esperar antes de enviar.
 */
export function antibanPrecheck(message: string): AntibanGateResult {
  const st = state();
  const dailyMax = envInt('WA_ANTIBAN_DAILY_MAX', 120);
  const gapMs = envInt('WA_ANTIBAN_GAP_MS', 12000);
  const now = Date.now();

  if (st.count >= dailyMax) {
    return {
      ok: false,
      error: `Limite diário anti-ban atingido (${dailyMax} msgs). Aguarde o próximo dia ou aumente WA_ANTIBAN_DAILY_MAX com cautela.`,
    };
  }

  const hash = simpleHash(message);
  if (hash && hash === st.lastHash) {
    st.lastHashCount += 1;
    if (st.lastHashCount >= 3) {
      return {
        ok: false,
        error:
          'Anti-ban: a mesma mensagem foi enviada várias vezes seguidas. Personalize o texto (nome/contexto) antes de continuar.',
      };
    }
  } else {
    st.lastHash = hash;
    st.lastHashCount = 1;
  }

  const since = now - (st.lastSentAt || 0);
  const needGap = Math.max(0, gapMs - since);
  const typing = humanTypingDelayMs(message);
  const waitMs = Math.max(needGap, Math.min(typing, envInt('WA_ANTIBAN_MAX_MS', 35000)));

  return { ok: true, waitMs, reason: needGap > 0 ? 'gap+typing' : 'typing' };
}

/** Marca envio bem-sucedido (chamar só após HTTP 2xx). */
export function antibanRecordSuccess(message: string): void {
  const st = state();
  st.count += 1;
  st.lastSentAt = Date.now();
  const hash = simpleHash(message);
  if (hash === st.lastHash) st.lastHashCount = Math.max(1, st.lastHashCount);
  else {
    st.lastHash = hash;
    st.lastHashCount = 1;
  }
}

export function antibanStats(): { day: string; sentToday: number; dailyMax: number; lastSentAt: number } {
  const st = state();
  return {
    day: st.dayKey,
    sentToday: st.count,
    dailyMax: envInt('WA_ANTIBAN_DAILY_MAX', 120),
    lastSentAt: st.lastSentAt,
  };
}

/** Aguarda o waitMs do precheck (com pequeno jitter extra). */
export async function antibanWait(waitMs: number): Promise<void> {
  const extra = Math.floor(Math.random() * 1500);
  await sleep(Math.max(0, waitMs + extra));
}
