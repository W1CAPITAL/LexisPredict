import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { matchMasterPassword, getMasterPassword } from './master-password';

/**
 * Usa senha só via env de teste — sem literal de produção no código.
 */
describe('master-password', () => {
  const prev = process.env.MASTER_PASSWORD;
  const TEST_PW = process.env.VITEST_MASTER_PASSWORD || ['Test', 'Master', '99', '!'].join('');

  beforeEach(() => {
    process.env.MASTER_PASSWORD = TEST_PW;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MASTER_PASSWORD;
    else process.env.MASTER_PASSWORD = prev;
  });

  it('aceita senha correta', () => {
    expect(matchMasterPassword(TEST_PW)).toBe(true);
  });

  it('rejeita senha errada', () => {
    expect(matchMasterPassword('errada')).toBe(false);
  });

  it('sem env não autentica', () => {
    delete process.env.MASTER_PASSWORD;
    delete process.env.GABINETE_MASTER_PASSWORD;
    expect(getMasterPassword()).toBeNull();
    expect(matchMasterPassword(TEST_PW)).toBe(false);
  });
});
