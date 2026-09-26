import { describe, expect, it } from 'vitest';
import { simulateScenarios } from './scenario-engine';

const input = {
  seed: 'lexis',
  iterations: 1000,
  options: [
    { id: 'a', label: 'A', baseScore: 10, factors: [{ name: 'impacto', min: 1, likely: 2, max: 4, weight: 2 }] },
    { id: 'b', label: 'B', baseScore: 8, factors: [{ name: 'impacto', min: 1, likely: 2, max: 3, weight: 1 }] },
  ],
};

describe('scenario simulator', () => {
  it('is deterministic for the same seed', () => {
    const a = simulateScenarios(input);
    const b = simulateScenarios(input);
    expect(a).toEqual(b);
  });

  it('returns percentiles and top rates', () => {
    const result = simulateScenarios(input);
    expect(result.options).toHaveLength(2);
    expect(result.options[0].p10).toBeLessThanOrEqual(result.options[0].p50);
    expect(result.options[0].p50).toBeLessThanOrEqual(result.options[0].p90);
    const total = result.options.reduce((sum, option) => sum + option.topRate, 0);
    expect(total).toBeCloseTo(1, 8);
  });
});
