import { describe, expect, it } from 'vitest';
import { localQuickReply } from './local-quick';
describe('local quick response, not masquerading as an LLM', () => {
  it.each(['OLÁ MARILENE','OLÁ MARILKENE','olá','oi','bom dia'])('replies immediately to %s', q => {
    expect(localQuickReply(q)).toContain('Olá!');
  });
  it('never fabricates legal replies or answers outside greetings', () => {
    expect(localQuickReply('O que aconteceu no processo 1234567-89.2026.8.26.0100?')).toBeNull();
    expect(localQuickReply('Explique a revisão de juros')).toBeNull();
  });
});
