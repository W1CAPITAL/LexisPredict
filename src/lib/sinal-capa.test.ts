import { describe, it, expect } from 'vitest';
import { getSinalCapa } from './sinal-capa';

describe('getSinalCapa', () => {
  it('prioriza baixa/trânsito', () => {
    const s = getSinalCapa({
      datajud_encerrado_tribunal: true,
      datajud_encerrado_motivo: 'Baixa definitiva',
      status: 'No Prazo',
    } as any);
    expect(s.titulo).toMatch(/BAIXA|TRÂNSITO/i);
    expect(s.prioridade).toBeGreaterThanOrEqual(90);
  });

  it('não emite alerta de busca e apreensão', () => {
    const s = getSinalCapa({
      evento_tipo: 'ba',
      evento_resumo: 'ALERTA: BUSCA E APREENSÃO',
      indicio_busca_apreensao: true,
      status: 'No Prazo',
    } as any);
    expect(s.titulo).not.toMatch(/BUSCA E APREENS/i);
  });

  it('titulo de sentença procedente', () => {
    const s = getSinalCapa({
      evento_tipo: 'sentenca_procedente',
      datajud_ultimo_nome: 'Sentença',
      status: 'No Prazo',
    } as any);
    expect(s.titulo).toMatch(/PROCEDENTE/i);
  });
});
