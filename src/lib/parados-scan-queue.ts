/**
 * Fila + checkpoint do scanner da aba Processos parados.
 * Recarregar / sair do app retoma de onde parou.
 */
export type ParadosScanMode = "parados" | "sem_scan" | "lista";

export type ParadosScanCheckpoint = {
  queue: string[];
  index: number;
  ok: number;
  fail: number;
  skipped: number;
  mode: ParadosScanMode;
  startedAt: string;
  lastProtocolo?: string;
  lastError?: string;
};

const KEY = "lexis_parados_scan_ckpt";
const SCAN_GAP_MS = 8 * 60 * 60 * 1000; // 8h — não reauditar o mesmo CNJ

export function loadParadosScanCkpt(): ParadosScanCheckpoint | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as ParadosScanCheckpoint;
    if (!Array.isArray(j.queue) || typeof j.index !== "number") return null;
    if (j.index >= j.queue.length) {
      clearParadosScanCkpt();
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export function saveParadosScanCkpt(ck: ParadosScanCheckpoint) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ck));
  } catch {
    /* quota */
  }
}

export function clearParadosScanCkpt() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}

export function isScanFresh(consultadoEm?: string | null, now = Date.now()): boolean {
  if (!consultadoEm) return false;
  const t = Date.parse(String(consultadoEm));
  if (!Number.isFinite(t)) return false;
  return now - t < SCAN_GAP_MS;
}

export function sleepMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Delay entre CNJs — sobe um pouco após erro (anti 429). */
export function scanDelayMs(failStreak: number) {
  const base = 650 + Math.floor(Math.random() * 400);
  return Math.min(8000, base + failStreak * 700);
}
