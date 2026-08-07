import { describe, it, expect } from 'vitest';
import { sanitizeEventoResumo } from './case-logic';

describe('sanitizeEventoResumo', () => {
  it('remove tag BA legada', () => {
    const s = sanitizeEventoResumo('ALERTA: BUSCA E APREENSÃO | SENTENÇA');
    expect(s || '').not.toMatch(/BUSCA E APREENS/i);
    expect(s || '').not.toMatch(/ALERTA:/i);
  });
  it('retorna null para lixo só de separadores', () => {
    expect(sanitizeEventoResumo(' | ')).toBeNull();
  });
  it('mantém texto útil', () => {
    const s = sanitizeEventoResumo('Sentença parcial de procedência');
    expect(s).toMatch(/Sentença/i);
  });
});
