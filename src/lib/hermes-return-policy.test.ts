import { describe, it, expect } from 'vitest';
import { buildHermesReturnReview, type HermesCourtSnapshot } from '@/lib/hermes-return-policy';

const base = {
  cliente: 'MARIA SILVA', protocolo: '1234567-89.2026.8.26.0001',
  ultimoRetorno: '2026-10-01', proximoRetorno: '2026-11-10',
  today: '2026-11-10', status: 'EM ANDAMENTO',
};
const both: HermesCourtSnapshot = { djenOk: true, datajudOk: true, events: [] };

describe('Hermes: automação de retornos com evidência', () => {
  it('não transforma falha de tribunal em afirmação de ausência de andamento', () => {
    const result = buildHermesReturnReview(base, { ...both, djenOk: false, datajudOk: false });
    expect(result.state).toBe('unavailable');
    expect(result.highlights.some(x => /indispon/i.test(x.text))).toBe(true);
    expect(result.messageDraft).toBeNull();
  });

  it('mostra novidade oficial posterior ao último retorno sem inventar prazo jurídico', () => {
    const result = buildHermesReturnReview(base, {
      ...both,
      events: [{ source: 'DJEN', at: '2026-11-07', text: 'Intimação para apresentar documentos', url: 'https://comunica.pje.jus.br/consulta?id=10' }],
    });
    expect(result.state).toBe('ready');
    expect(result.priorityScore).toBeGreaterThanOrEqual(85);
    expect(result.highlights[0].source).toBe('DJEN');
    expect(result.messageDraft).toContain('07/11/2026');
    expect(result.messageDraft).not.toMatch(/prazo de \d+ dias/);
    expect(result.suggestedNextReturn).toBe('2026-12-05');
  });

  it('não chama atualização anterior ao último retorno de novidade', () => {
    const result = buildHermesReturnReview(base, {
      ...both, events: [{ source: 'DataJud', at: '2026-09-20T10:00:00Z', text: 'Juntada de documento', url: null }],
    });
    expect(result.highlights.some(x => x.kind === 'new')).toBe(false);
    expect(result.messageDraft).toContain('não identificamos registro posterior');
  });

  it('sem último retorno não declara um movimento como novo desde o atendimento', () => {
    const result = buildHermesReturnReview({ ...base, ultimoRetorno: null }, {
      ...both, events: [{ source: 'DJEN', at: '2026-11-08', text: 'Publicação', url: null }],
    });
    expect(result.highlights.some(x => x.kind === 'new')).toBe(false);
    expect(result.highlights.some(x => /último retorno/i.test(x.text))).toBe(true);
  });

  it('não considera processo encerrado como retorno automaticamente contatado', () => {
    const result = buildHermesReturnReview({ ...base, status: 'ENCERRADO' }, both);
    expect(result.state).toBe('skipped');
    expect(result.messageDraft).toBeNull();
  });

  it('recomendação administrativa é 25-35 dias e não altera o cadastro', () => {
    const result = buildHermesReturnReview(base, both);
    expect(result.suggestedNextReturn).toBe('2026-12-10');
    expect(result.highlights.every(x => x.text.length <= 500)).toBe(true);
  });
});
