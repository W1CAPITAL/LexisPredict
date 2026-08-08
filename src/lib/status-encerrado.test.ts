import { describe, it, expect } from 'vitest';
import { isCasoEncerrado, STATUS_ENCERRADOS } from './status-encerrado';

describe('isCasoEncerrado', () => {
  it('retorna false para null/undefined', () => {
    expect(isCasoEncerrado(null)).toBe(false);
    expect(isCasoEncerrado(undefined)).toBe(false);
  });

  it('detecta status textual de encerrado', () => {
    expect(isCasoEncerrado({ status: 'Encerrado' })).toBe(true);
    expect(isCasoEncerrado({ situacao: 'ARQUIVADO' })).toBe(true);
    expect(isCasoEncerrado({ statusManual: 'extinto' })).toBe(true);
  });

  it('não encerra só por flag de telemetria de tribunal', () => {
    expect(
      isCasoEncerrado({
        status: 'No Prazo',
        datajud_encerrado_tribunal: true,
      })
    ).toBe(false);
  });

  it('caso ativo permanece ativo', () => {
    expect(isCasoEncerrado({ status: 'Vencido', situacao: 'EM ANDAMENTO' })).toBe(false);
  });

  it('lista de status conhecidos não vazia', () => {
    expect(STATUS_ENCERRADOS.length).toBeGreaterThan(3);
  });
});
