import { describe, expect, it } from 'vitest';
import { extrairAudienciasOficiais } from '@/lib/audiencias-monitor';

describe('intervalo completo de sessão virtual', () => {
  it('lê início e término no formato Período da sessão, mesmo após a data de publicação', () => {
    const notice = [
      'Disponibilizado no Diário Eletrônico - Pauta - no dia 11/11/2026.',
      'PAUTA DE SESSÃO VIRTUAL DE JULGAMENTO.',
      'Período da sessão: 24/11/2026 00:00 a 01/12/2026 23:59.',
      'Eventuais pedidos de destaque deverão observar o prazo próprio.',
    ].join(' ');
    const event = extrairAudienciasOficiais(notice).find((item) => item.tipo === 'sessao_virtual');
    expect(event).toMatchObject({
      tipo: 'sessao_virtual',
      data: '2026-11-24',
      dataFim: '2026-12-01',
      hora: '00:00',
      horaFim: '23:59',
      chave: 'sessao_virtual:2026-11-24:00:00',
    });
    expect(event?.trecho).toContain('Período da sessão: 24/11/2026 00:00 a 01/12/2026 23:59');
  });

  it('associa a hora final à data final, sem reutilizar a hora de início', () => {
    const notice = 'SESSÃO VIRTUAL DE JULGAMENTO. Início em 04/11/2026 às 09:00 e término em 11/11/2026 às 18:00.';
    const event = extrairAudienciasOficiais(notice)[0];
    expect(event).toMatchObject({
      data: '2026-11-04',
      dataFim: '2026-11-11',
      hora: '09:00',
      horaFim: '18:00',
    });
  });
});
