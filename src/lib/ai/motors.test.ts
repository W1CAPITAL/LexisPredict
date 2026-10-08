import { describe, expect, it } from 'vitest';
import { resolveMotorId, getMotor, MOTORS } from './motors';
describe('genuine local LLM is separate from deterministic scripts', () => {
  it('exposes local_llm as a browser inference engine', () => {
    expect(resolveMotorId('local_llm')).toBe('local_llm');
    expect(getMotor('local_llm').scope).toBe('browser');
    expect(MOTORS.some(m=>m.id==='colibri'&&m.scope==='server')).toBe(true);
  });
  it('does not relabel the legacy script engine as a model', () => {
    expect(resolveMotorId('local_only')).toBe('local_only');
    expect(resolveMotorId('qwen-local')).toBe('local_llm');
  });
});
