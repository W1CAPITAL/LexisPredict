import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

describe('LexisPredict wine/silver screenshots regression', () => {
  it('uses semantic wine colors for Processos buttons, metrics, and selected rows', () => {
    const css = read('src/app/code-xr-unified.css');
    expect(css).toContain('--lx-process-accent: hsl(var(--primary));');
    expect(css).toContain('--lx-process-selected: hsl(var(--primary) / .10);');
    expect(css).not.toMatch(/--lx-process-accent:\s*#f27548/i);
    expect(css).not.toMatch(/background:\s*#f47745\s*!important/);
    expect(css).not.toMatch(/background:\s*#ebefff\s*!important/);
  });
  it('uses the wine sidebar instead of hardcoded navy and blue pills', () => {
    const sidebar = read('src/components/layout/sidebar-vertical.tsx');
    expect(sidebar).toContain('#3B0B1E');
    expect(sidebar).toContain('#6D1734');
    expect(sidebar).not.toContain('bg-[#0f4e83]');
    expect(sidebar).not.toContain('bg-[#1769ff]');
  });
  it('keeps action buttons theme-aware and high-contrast', () => {
    const center = read('src/components/processos/processos-command-center.tsx');
    expect(center).toContain('bg-primary text-primary-foreground');
    expect(center).not.toContain('h-8 bg-blue-600 text-[11px] font-bold');
  });
});
