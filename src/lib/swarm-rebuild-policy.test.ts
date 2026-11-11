import { describe, expect, it } from 'vitest';
import { shouldPlaySwarmRebuild } from '@/lib/swarm-rebuild-policy';

describe('política da animação Swarm Rebuild', () => {
  it('executa uma vez por rota durante a mesma sessão do app', () => {
    const visited = new Set<string>();
    expect(shouldPlaySwarmRebuild('/dashboard', visited)).toBe(true);
    expect(shouldPlaySwarmRebuild('/dashboard', visited)).toBe(false);
    expect(shouldPlaySwarmRebuild('/audiencias', visited)).toBe(true);
    expect(shouldPlaySwarmRebuild('/dashboard', visited)).toBe(false);
  });

  it('reproduz novamente depois de F5 ou em uma nova aba', () => {
    const beforeReload = new Set<string>();
    expect(shouldPlaySwarmRebuild('/tarefas', beforeReload)).toBe(true);
    const afterReload = new Set<string>();
    expect(shouldPlaySwarmRebuild('/tarefas', afterReload)).toBe(true);
  });

  it('não cobre páginas de autenticação e rotas técnicas', () => {
    const visited = new Set<string>();
    for (const path of ['/login', '/signup', '/auth/callback', '/api/audiencias']) {
      expect(shouldPlaySwarmRebuild(path, visited)).toBe(false);
    }
  });
});
