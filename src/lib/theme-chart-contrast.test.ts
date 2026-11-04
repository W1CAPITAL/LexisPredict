import { describe, it, expect } from 'vitest';
import { AUTHORITY_PRESETS, deriveCharts, getPresetColors, hslToHex } from './theme';
import { getContrastRatio } from './utils';

describe('Theme charts: visual data contrast', () => {
  for (const preset of AUTHORITY_PRESETS) for (const mode of ['light','dark'] as const) {
    it(`${preset.id} / ${mode}: each colored series contrasts with card and canvas`, () => {
      const c = getPresetColors(preset, mode);
      const tokens = deriveCharts(c.primary, mode, [c.background, c.bgSecondary]);
      expect(tokens).toHaveLength(5);
      for (const token of tokens) {
        const [h, saturation, lightness] = token.split(' ').map(Number);
        const hex = hslToHex(h, saturation, lightness);
        expect(getContrastRatio(hex,c.background)).toBeGreaterThanOrEqual(3);
        expect(getContrastRatio(hex,c.bgSecondary)).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
