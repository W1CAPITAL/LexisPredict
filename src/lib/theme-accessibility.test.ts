import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTHORITY_PRESETS, getPresetColors } from './theme';
import { getContrastRatio } from './utils';

describe('Accessibility across all LexisPredict theme presets', () => {
  it('keeps the 24 selectable presets distinct, including wine/silver as default', () => {
    expect(AUTHORITY_PRESETS).toHaveLength(24);
    expect(getPresetColors(AUTHORITY_PRESETS.find(p => p.id === 'minimal-steel')!, 'light').primary).toBe('#6D1734');
    expect(getPresetColors(AUTHORITY_PRESETS.find(p => p.id === 'ocean')!, 'light').primary).not.toBe('#6D1734');
  });

  for (const preset of AUTHORITY_PRESETS) {
    for (const mode of ['light','dark'] as const) {
      it(`${preset.id} /${mode} passes text, border, input and navigation minimums`, () => {
        const c = getPresetColors(preset, mode);
        for (const surface of [c.background, c.bgSecondary]) {
          expect(getContrastRatio(c.foreground, surface)).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(c.fontMuted, surface)).toBeGreaterThanOrEqual(4.5);
          expect(getContrastRatio(c.border, surface)).toBeGreaterThanOrEqual(3);
        }
        const nav = c.nav ?? c.bgSecondary;
        const navText = getContrastRatio(nav,'#FFFFFF') >= getContrastRatio(nav,'#000000') ? '#FFFFFF' : '#000000';
        expect(getContrastRatio(navText,nav)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('does not force one brand palette onto every selected preset', () => {
    const css = readFileSync('src/app/wine-silver-brand.css', 'utf8');
    expect(css).not.toContain(':root:not(.dark) {\n  --background: 270 9% 96% !important;');
    expect(css).not.toContain(':root.dark {\n  --background: 288 14% 7% !important;');
    expect(css).toContain('data-lexis-preset="minimal-steel"');
  });
});
