import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { recoverHermesTimelineSource } from '@/lib/hermes-timeline-fallback';
const cnj = '10012183620265020040';
const sample = [
  { source: 'DataJud', at: '2026-11-07', text: 'Julgado procedente em parte' },
  { source: 'DJEN', at: '2026-11-10', text: 'Publicação de sentença', url: 'https://comunica.pje.jus.br/abc' },
];
describe('Histórico automático do Hermes na aba Mov.', () => {
  it('restaura somente o DataJud salvo quando a consulta do DataJud falhou', () => {
    const saved = recoverHermesTimelineSource(cnj, sample, { datajudOk: false, djenOk: true });
    expect(saved?.datajudCount).toBe(1);
    expect(saved?.djenCount).toBe(0);
    expect(saved?.source.movimentos).toEqual([{
      dataHora: '2026-11-07', nome: 'Julgado procedente em parte',
      complemento: 'Histórico Hermes salvo; fonte não revalidada nesta consulta.',
    }]);
  });
  it('nunca mistura eventos salvos com as duas fontes novas confirmadas', () => {
    expect(recoverHermesTimelineSource(cnj, sample, { datajudOk: true, djenOk: true })).toBeNull();
  });
  it('permite ler cronologia DJEN e DataJud salvas quando ambas falham', () => {
    const saved = recoverHermesTimelineSource(cnj, sample, { datajudOk: false, djenOk: false });
    expect(saved?.datajudCount).toBe(1);
    expect(saved?.djenCount).toBe(1);
    expect(saved?.source.comunicacoes).toEqual([{
      data_disponibilizacao: '2026-11-10', texto: 'Publicação de sentença',
      tipoComunicacao: 'Publicação DJEN (histórico Hermes)', link: 'https://comunica.pje.jus.br/abc',
    }]);
  });
  it('ignora datas inválidas, fontes falsas e URLs externas', () => {
    const saved = recoverHermesTimelineSource(cnj, [
      { source: 'DJEN', at: '2026-11-10', text: 'Ato', url: 'https://fake.example/roubo' },
      { source: 'DJEN', at: '2026-13-42', text: 'Ato errado' },
      { source: 'Operacional', at: '2026-11-11', text: 'Invenção' },
    ], { datajudOk: false, djenOk: false });
    expect(saved?.djenCount).toBe(1);
    expect(saved?.source.comunicacoes).toEqual([{
      data_disponibilizacao: '2026-11-10', texto: 'Ato',
      tipoComunicacao: 'Publicação DJEN (histórico Hermes)',
    }]);
  });
  it('recusa número inválido e não duplica movimentos', () => {
    expect(recoverHermesTimelineSource('123', sample, { datajudOk: false, djenOk: false })).toBeNull();
    expect(recoverHermesTimelineSource(cnj, [sample[0], sample[0]], { datajudOk: false, djenOk: false })?.datajudCount).toBe(1);
  });
  it('integra o fallback exclusivamente na empresa autenticada sem chamar fontes extras', () => {
    const action = readFileSync('src/app/actions/processos-movements-action.ts', 'utf8');
    expect(action).toContain(".from('hermes_portfolio_scans')");
    expect(action).toContain(".eq('empresa_id',ctx.empresa_id)");
    expect(action).toContain('recoverHermesTimelineSource');
    expect(action).toContain('mergeProcessTimelineEntries');
    expect(action).toContain('consulta atual');
  });
});
