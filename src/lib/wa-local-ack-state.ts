/**
 * Delivery acknowledgements are a monotonic, fail-closed state machine.
 * A provider accepting a message is not the same as device delivery.
 * Shared by the server acknowledgement endpoint, inspired by Wechaty's
 * explicit typed events rather than best-effort arbitrary status strings.
 */
export type WaAckState = 'accepted' | 'delivered' | 'read' | 'failed' | 'uncertain';
export type WaAckDecision = 'advance' | 'same' | 'reject';

const transitions: Readonly<Record<string, readonly WaAckState[]>> = {
  claimed: ['accepted', 'failed', 'uncertain'],
  accepted: ['delivered', 'read'],
  delivered: ['read'],
};

const allowed = new Set<WaAckState>(['accepted', 'delivered', 'read', 'failed', 'uncertain']);

export function isWaAckState(value: unknown): value is WaAckState {
  return typeof value === 'string' && allowed.has(value as WaAckState);
}

export function isWaJobId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function waAckDecision(previous: unknown, next: unknown): WaAckDecision {
  if (!isWaAckState(next) || typeof previous !== 'string') return 'reject';
  if (previous === next) return 'same';
  return transitions[previous]?.includes(next) ? 'advance' : 'reject';
}
