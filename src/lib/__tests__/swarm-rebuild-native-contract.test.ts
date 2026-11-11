import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Swarm Rebuild nativo', () => {
  it('monta a experiência no shell persistente do app', () => {
    const shell = read('src/components/layout/persistent-app-shell.tsx');
    expect(shell).toContain('SwarmRebuildIntro');
    expect(shell).toContain('<SwarmRebuildIntro');
  });

  it('não executa a extensão CRX nem varre a árvore viva da página', () => {
    const component = read('src/components/system/swarm-rebuild-intro.tsx');
    expect(component).not.toMatch(/chrome\.runtime|browser\.runtime|querySelectorAll|MutationObserver|AudioContext|fetch\(/);
    expect(component).toContain('shouldPlaySwarmRebuild');
    expect(component).toContain('Pular');
  });

  it('usa animações leves de transform e opacidade', () => {
    const css = read('src/app/swarm-loading.css');
    expect(css).toContain('@keyframes lx-swarm-rebuild-exit');
    expect(css).toContain('@keyframes lx-swarm-rebuild-piece');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
