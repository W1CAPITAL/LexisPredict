import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { matchMasterPassword, getMasterPassword } from './master-password';

describe('master-password', () => {
  const prev = process.env.MASTER_PASSWORD;
  beforeEach(() => {
    process.env.MASTER_PASSWORD = 'TestMaster99!';
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.MASTER_PASSWORD;
    else process.env.MASTER_PASSWORD = prev;
  });

  it('aceita senha correta', () => {
    expect(matchMasterPassword('TestMaster99!')).toBe(true);
  });
  it('rejeita senha errada', () => {
    expect(matchMasterPassword('errada')).toBe(false);
  });
  it('rejeita se env ausente', () => {
    delete process.env.MASTER_PASSWORD;
    delete process.env.GABINETE_MASTER_PASSWORD;
    expect(getMasterPassword()).toBeNull();
    expect(matchMasterPassword('TestMaster99!')).toBe(false);
  });
});
