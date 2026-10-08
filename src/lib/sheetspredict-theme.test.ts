import { describe, expect, it } from 'vitest';
import { AUTHORITY_PRESETS, getPresetColors } from './theme';
import { getContrastRatio } from './utils';

const ids = ['default','clean','dark','midnight','graphite','emerald','wine','violet','gold','contrast'];

describe('SheetsPredict theme import', () => {
  it('has all 10 themes with distinct identifiers alongside existing Lexis presets', () => {
    for (const id of ids) expect(AUTHORITY_PRESETS.some(p => p.id === 'sheetspredict-' + id)).toBe(true);
    expect(AUTHORITY_PRESETS.some(p => p.id === 'minimal-steel')).toBe(true);
  });
  it('keeps the original intended light/dark mode', () => {
    for (const id of ids) {
      const p = AUTHORITY_PRESETS.find(p => p.id === 'sheetspredict-' + id)!;
      expect(p.source).toBe('sheetspredict');
      expect(p.preferredMode).toBe(['dark','midnight','graphite','violet','gold','contrast'].includes(id) ? 'dark' : 'light');
    }
  });
  it('keeps readable primary/surface combinations', () => {
    for (const id of ids) {
      const p = AUTHORITY_PRESETS.find(p => p.id === 'sheetspredict-' + id)!;
      for (const mode of ['light','dark'] as const) {
        const c = getPresetColors(p, mode);
        expect(Math.max(getContrastRatio(c.bgSecondary, c.foreground), getContrastRatio(c.bgSecondary, '#FFFFFF'), getContrastRatio(c.bgSecondary, '#000000'))).toBeGreaterThanOrEqual(4.5);
        expect(c.nav).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});
