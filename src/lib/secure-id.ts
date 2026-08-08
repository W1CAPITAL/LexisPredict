/**
 * IDs e jitter sem Math.random (crypto).
 */
export function secureRandomId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  // Node < 19 / fallback
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

export function secureRandomFloat(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return randomBytes(4).readUInt32BE(0) / 0x100000000;
}

/** Inteiro em [min, max] inclusive */
export function secureRandomInt(min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return a + Math.floor(secureRandomFloat() * (b - a + 1));
}
