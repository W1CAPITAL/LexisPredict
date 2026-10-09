import { describe, expect, it } from 'vitest';
import { buildPublicationMessage, PUBLICATION_TEMPLATE_PREVIEWS, type PublicationEvent, type PublicationMerit } from './wa-publication-templates';

describe('templates for judicial notices, not random spam variants', () => {
  const kinds: PublicationEvent[]=['baixa','transito','extincao','arquivamento','encerramento'];
  const verdicts: PublicationMerit[]=['procedente','parcial','improcedente','sem_merito'];
  it('renders five semantically distinct examples without personal data',()=>{
    const models=PUBLICATION_TEMPLATE_PREVIEWS();
    expect(models.map(m=>m.kind)).toEqual(kinds);
    expect(new Set(models.map(m=>m.message)).size).toBe(5);
    expect(models.every(m=>m.message.includes('{numero_cnj}')&&m.message.includes('{data_evento}'))).toBe(true);
    expect(models.every(m=>m.message.includes('SAIR'))).toBe(true);
  });
  it('always states supported case facts and opt-out, never guarantees payment',()=>{
    for (const kind of kinds) for (const verdict of verdicts) {
      const msg=buildPublicationMessage({
        firstName:'Maria',cnj:'1000000-00.2025.8.26.0100',
        date:'07/10/2026',source:'DJEN',kind,verdict,
      });
      expect(msg).toContain('Maria');
      expect(msg).toContain('1000000-00.2025.8.26.0100');
      expect(msg).toContain('07/10/2026');
      expect(msg).toContain('DJEN');
      expect(msg).toContain('SAIR');
      expect(msg).not.toMatch(/garantimos (pagamento|recebimento|ganho)/i);
    }
  });
  it('does not turn dismissal without merits into an adverse merits judgment',()=>{
    const msg=buildPublicationMessage({
      firstName:'Ana',cnj:'1000000-00.2025.8.26.0100',
      date:'07/10/2026',source:'DataJud',kind:'extincao',verdict:'sem_merito',
    });
    expect(msg).toContain('sem análise do mérito');
    expect(msg).toContain('não se trata de procedência ou improcedência');
  });
});
