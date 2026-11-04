import { describe, expect, it } from 'vitest';
import { isValidProcessDate, validateProcessDateRange, matchesProcessDateRange, PROCESSOS_DATE_FIELDS } from './processos-date-range';

describe('Processos — filtros de data De/Até', () => {
  it('identifica datas ISO válidas e rejeita datas impossíveis', () => {
    expect(isValidProcessDate('2026-11-04')).toBe(true);
    expect(isValidProcessDate('2026-02-30')).toBe(false);
    expect(isValidProcessDate('04/11/2026')).toBe(false);
  });
  it('rejeita intervalo invertido', () => {
    expect(validateProcessDateRange('2026-11-10','2026-11-01')).toMatch(/anterior/i);
    expect(validateProcessDateRange('2026-11-01','2026-11-10')).toBeNull();
  });
  it('inclui as duas extremidades do intervalo e entende horários UTC no fuso de SP', () => {
    const c = { datajud_ultimo_movimento:'2026-11-05T01:20:00Z' };
    expect(matchesProcessDateRange(c,'movimento','2026-11-04','2026-11-04')).toBe(true);
    expect(matchesProcessDateRange(c,'movimento','2026-11-05','2026-11-05')).toBe(false);
  });
  it('não confunde movimentação com distribuição ou retorno', () => {
    const c={ datajud_ultimo_movimento:'2026-10-15T12:00:00Z', proximoPrazo:'2026-11-09', dataDistribuicao:'2025-02-03' };
    expect(matchesProcessDateRange(c,'proximo-retorno','2026-11-09','2026-11-09')).toBe(true);
    expect(matchesProcessDateRange(c,'movimento','2026-11-09','2026-11-09')).toBe(false);
    expect(matchesProcessDateRange(c,'distribuicao','2025-02-03','2025-02-03')).toBe(true);
  });
  it('não apresenta como resultado um registro sem a data selecionada', () => {
    expect(matchesProcessDateRange({cliente:'SEM MOVIMENTO'},'movimento','2026-11-01','')).toBe(false);
  });
  it('oferece apenas campos persistidos no Supabase e não rótulo ambíguo', () => {
    expect(PROCESSOS_DATE_FIELDS.movimento.column).toBe('datajud_ultimo_movimento');
    expect(PROCESSOS_DATE_FIELDS.distribuicao.column).toBe('data_distribuicao');
  });
});
