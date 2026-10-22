import { describe, expect, it } from 'vitest';
import { resolveMotorId, getMotor, MOTORS, loadPreferredMotor } from './motors';
describe('genuine local LLM is separate from deterministic scripts', () => {
  it('exposes local_llm as a browser inference engine', () => {
    expect(resolveMotorId('local_llm')).toBe('local_llm');
    expect(getMotor('local_llm').scope).toBe('browser');
    expect(MOTORS.some(m=>m.id==='colibri'&&m.scope==='server')).toBe(true);
  });
  it('defaults to true local inference on server and exposes all three micro-models', () => {
    expect(loadPreferredMotor()).toBe('local_llm');
    expect(resolveMotorId()).toBe('local_llm');
    expect(getMotor('local_gemma').scope).toBe('browser');
    expect(getMotor('local_lfm').scope).toBe('browser');
    expect(getMotor('local_llm').label).toContain('Qwen');
  });
    it('does not relabel the legacy script engine as a model', () => {
    expect(resolveMotorId('local_only')).toBe('local_only');
    expect(resolveMotorId('qwen-local')).toBe('local_llm');
  });
});
