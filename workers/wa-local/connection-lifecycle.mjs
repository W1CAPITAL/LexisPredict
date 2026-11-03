/**
 * WA.Auto local transport safeguards, inspired by Wechaty's explicit
 * scan/login/logout/ready lifecycle and event-driven puppet boundary.
 * No Wechaty runtime is installed: Baileys remains the existing transport.
 *
 * These in-memory guards are intentionally bounded; only the CRM job queue
 * can guarantee durable at-most-once dispatch across worker restarts.
 */
export function reconnectDelay(attempt, random = Math.random) {
  const n = Math.max(1, Math.min(12, Number.isFinite(attempt) ? Math.trunc(attempt) : 1));
  const exponential = Math.min(60000, 2500 * 2 ** (n - 1));
  const sample = Number(random());
  const value = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
  return Math.min(60000, Math.round(exponential * (0.8 + 0.4 * value)));
}

export function createInboundDeduper({
  ttlMs = 10 * 60 * 1000,
  maxEntries = 2048,
  now = Date.now,
} = {}) {
  const seen = new Map();
  const cap = Math.max(1, Math.min(20000, Math.trunc(maxEntries) || 2048));
  function prune(time) {
    for (const [key, expiry] of seen) {
      if (expiry > time) break;
      seen.delete(key);
    }
    while (seen.size >= cap) seen.delete(seen.keys().next().value);
  }
  return {
    claim(key) {
      if (typeof key !== 'string' || !key || key.length > 256) return false;
      const time = now();
      if (seen.get(key) > time) return false;
      seen.delete(key);
      prune(time);
      seen.set(key, time + ttlMs);
      return true;
    },
    release(key) { seen.delete(key); },
    size() { return seen.size; },
  };
}

/** Delivery receipt can arrive before sendMessage()'s promise resolves.
 * Keep only message ID and maximum ACK; never store message text or contacts.
 */
export function createEarlyReceiptBuffer({
  ttlMs = 10 * 60 * 1000,
  maxEntries = 2048,
  now = Date.now,
} = {}) {
  const values = new Map();
  const cap = Math.max(1, Math.min(20000, Math.trunc(maxEntries) || 2048));
  function prune(time) {
    for (const [key, value] of values) {
      if (value.expiresAt > time) break;
      values.delete(key);
    }
    while (values.size >= cap) values.delete(values.keys().next().value);
  }
  return {
    observe(id, ack) {
      const n = Number(ack);
      if (typeof id !== 'string' || !id || id.length > 256 ||
          !Number.isFinite(n) || n < 3) return;
      const time = now();
      const old = values.get(id);
      const highest = Math.max(old?.expiresAt > time ? old.ack : 0, n);
      values.delete(id);
      prune(time);
      values.set(id, { ack: highest, expiresAt: time + ttlMs });
    },
    take(id) {
      const value = values.get(id);
      values.delete(id);
      return value?.expiresAt > now() ? value.ack : 0;
    },
    size() { return values.size; },
  };
}
