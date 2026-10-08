import { describe, expect, it } from 'vitest';
import { shardForPhone, shardForTelemetryEvent } from './dual-db-routing';

describe('dual database WhatsApp routing', () => {
  it('keeps the same contact on the same shard with or without Brazilian country code', () => {
    expect(shardForPhone('11987654321')).toBe(shardForPhone('5511987654321'));
    expect(shardForPhone('(11) 98765-4321')).toBe(shardForPhone('5511987654321'));
  });

  it('is stable across repeated calls', () => {
    const phone = '5511999988877';
    expect(shardForPhone(phone)).toBe(shardForPhone(phone));
  });

  it('distributes many distinct contacts across both shards', () => {
    const counts = { primary: 0, secondary: 0 };
    for (let i = 0; i < 1000; i++) counts[shardForPhone('55119' + String(10000000 + i))]++;
    expect(counts.primary).toBeGreaterThan(400);
    expect(counts.secondary).toBeGreaterThan(400);
  });

  it('rejects invalid keys instead of changing shard by accident', () => {
    expect(() => shardForPhone('123')).toThrow('Telefone inválido');
  });
});

describe('operational telemetry balancing', () => {
  it('sends individual events to deterministic independent shards', () => {
    expect(shardForTelemetryEvent('scan:evt-42')).toBe(shardForTelemetryEvent('scan:evt-42'));
    expect(() => shardForTelemetryEvent('')).toThrow('Identificador de telemetria');
  });
  it('spreads a large stream without a permanent hot-contact shard', () => {
    const counts = { primary: 0, secondary: 0 };
    for (let i = 0; i < 1000; i++) counts[shardForTelemetryEvent('alert:event-' + i)] += 1;
    expect(counts.primary).toBeGreaterThan(400);
    expect(counts.secondary).toBeGreaterThan(400);
  });
});
