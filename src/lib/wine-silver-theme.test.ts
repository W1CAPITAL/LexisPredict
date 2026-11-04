import { describe, expect, it } from 'vitest';
import { AUTHORITY_PRESETS, getPresetColors } from './theme';
import { getContrastRatio } from './utils';

/** Regression for the default LexisPredict visual identity and WCAG 2.2 AA. */
describe('LexisPredict default wine-and-silver palette', () => {
  const preset = AUTHORITY_PRESETS.find((item) => item.id === 'minimal-steel');

  it('keeps the existing default id while switching its visual identity', () => {
    expect(preset).toBeDefined();
    expect(preset?.name).toBe('Vinho e Prata');
    expect(getPresetColors(preset!, 'light').primary).toBe('#6D1734');
    expect(getPresetColors(preset!, 'dark').primary).toBe('#8A2E50');
  });

  it.each(['light', 'dark'] as const)('passes AA text and control contrast in %s mode', (mode) => {
    const c = getPresetColors(preset!, mode);
    for (const surface of [c.background, c.bgSecondary]) {
      expect(getContrastRatio(c.foreground, surface)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(c.fontMuted, surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(getContrastRatio('#FFFFFF', c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio('#FFFFFF', c.nav!)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(c.border, c.bgSecondary)).toBeGreaterThanOrEqual(3);
  });
});
