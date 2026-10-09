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
  it('does basic arithmetic offline without a model or eval',()=>{
    expect(localQuickReply('quanto é 5 mais 5')).toBe('O resultado é 10.');
    expect(localQuickReply('10 - 3')).toBe('O resultado é 7.');
    expect(localQuickReply('8 vezes 7')).toBe('O resultado é 56.');
    expect(localQuickReply('9 dividido por 0')).toBe('Não é possível dividir por zero.');
  });
  it('asks for a complete question instead of loading a 0.5B model for gibberish',()=>{
    expect(localQuickReply('a')).toContain('pergunta completa');
    expect(localQuickReply('abc')).toContain('pergunta completa');
  });
  it('does not fake free-form knowledge',()=>{
    expect(localQuickReply('quantas estrelas tem no céu')).toBeNull();
    expect(localQuickReply('quem é Elon Musk')).toBeNull();
  });
});
