
import { describe, it, expect } from 'vitest';
import { normalizeAssistantMotorChoice } from './chat-preference';
describe('assistant automatic routing', () => {
  it('keeps Omni in cascade mode', () => {
    for (const selected of ['omni', 'auto', 'cascade', null]) expect(normalizeAssistantMotorChoice(selected)).toBe('auto');
  });
  it('allows selecting Colibri or a specific provider', () => {
    expect(normalizeAssistantMotorChoice('colibri')).toBe('colibri');
    expect(normalizeAssistantMotorChoice('minicpm')).toBe('minicpm');
    expect(normalizeAssistantMotorChoice('claude')).toBe('claude');
    expect(normalizeAssistantMotorChoice('groq-llama')).toBe('groq');
  });
});
