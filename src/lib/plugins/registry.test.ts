import { describe, expect, it } from 'vitest';
import { findPluginManifest, PLUGINS } from './registry';
import { planAgentTeam } from '@/lib/agents/studio';

describe('plugin platform', () => {
  it('has unique plugin ids and explicit actions', () => {
    const ids = PLUGINS.map((plugin) => plugin.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PLUGINS.every((plugin) => plugin.actions.length > 0)).toBe(true);
  });

  it('registers world and agent studio plugins', () => {
    expect(findPluginManifest('world-sandbox')?.permissions).toContain('world:write');
    expect(findPluginManifest('agent-studio')?.actions).toContain('plan-team');
  });

  it('plans a specialized team from the goal', () => {
    const plan = planAgentTeam('Pesquisar fontes, simular um mundo e implementar a interface');
    const ids = plan.roles.map((role) => role.id);
    expect(ids).toContain('researcher');
    expect(ids).toContain('simulator');
    expect(ids).toContain('builder');
    expect(ids).toContain('qa');
  });
});
