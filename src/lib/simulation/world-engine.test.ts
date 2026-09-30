import { describe, expect, it } from 'vitest';
import { generateWorldChunk, simulateWorld } from './world-engine';

describe('world sandbox', () => {
  it('generates deterministic chunks for the same seed and coordinates', () => {
    const a = generateWorldChunk('alpha', 10, -4, 8);
    const b = generateWorldChunk('alpha', 10, -4, 8);
    expect(a).toEqual(b);
    expect(a.tiles).toHaveLength(64);
  });

  it('supports distant chunks without pre-allocating the world', () => {
    const near = generateWorldChunk('alpha', 0, 0, 4);
    const far = generateWorldChunk('alpha', 100000, -100000, 4);
    expect(near.tiles).toHaveLength(16);
    expect(far.tiles).toHaveLength(16);
    expect(far.chunkX).toBe(100000);
  });

  it('runs deterministic multi-agent episodes', () => {
    const a = simulateWorld({ seed: 'episode', ticks: 40, agents: 6 });
    const b = simulateWorld({ seed: 'episode', ticks: 40, agents: 6 });
    expect(a).toEqual(b);
    expect(a.agents).toHaveLength(6);
    expect(a.totals.distance).toBeGreaterThan(0);
  });
});
