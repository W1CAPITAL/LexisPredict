import { describe, expect, it } from 'vitest';
import { isAudienciaExpirada } from './audiencias-expiry';

describe('expiração pelo fuso do tribunal', () => {
  it('usa o fuso MT e só expira depois de ultrapassar o minuto final', () => {
    const event = { data: '2026-11-11', dataFim: '2026-11-11', horaFim: '09:00', fuso: 'MT' };
    expect(isAudienciaExpirada(event, new Date('2026-11-11T12:59:00.000Z'))).toBe(false); // 08:59 em MT
    expect(isAudienciaExpirada(event, new Date('2026-11-11T13:00:00.000Z'))).toBe(false); // 09:00 em MT
    expect(isAudienciaExpirada(event, new Date('2026-11-11T13:01:00.000Z'))).toBe(true); // 09:01 em MT
  });

  it('infere o fuso de TJCE quando o ato não declara uma sigla de fuso', () => {
    const event = { data: '2026-11-11', dataFim: '2026-11-11', horaFim: '09:00', tribunal: 'TJCE' };
    expect(isAudienciaExpirada(event, new Date('2026-11-11T11:59:00.000Z'))).toBe(false);
    expect(isAudienciaExpirada(event, new Date('2026-11-11T12:01:00.000Z'))).toBe(true);
  });

  it('preserva evento no mesmo dia quando o fuso não pode ser confirmado', () => {
    const event = { data: '2026-11-11', dataFim: '2026-11-11', horaFim: '09:00', tribunal: 'TRF99' };
    expect(isAudienciaExpirada(event, new Date('2026-11-11T12:30:00.000Z'))).toBe(false);
  });
});
