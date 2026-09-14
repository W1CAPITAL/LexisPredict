import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processarCaso } from './case-logic';
import { uniqueCases } from './case-identity';
import { isBuscaApreensaoReal } from './ba-real';
import { detectarBaCompleto, publicacaoBateComCarteira } from './busca-apreensao-logic';
import { computeKpiUnificado } from './kpi-unificado';
import { buildDashboardMetrics } from './dashboard-metrics';
import { statusEfetivo } from './prazo-status';
import { resolveTemNovoAndamento } from './novidade';
import { splitDjenDateRange, djenRetryDelay, waitForDjen } from './djen-scan-control';

const cnj = '1000000-12.2026.8.26.0100';
const base = (fields: Record<string, unknown> = {}) => ({ id: '1', protocolo: cnj, situacao: 'EM ANDAMENTO', proximoPrazo: '2026-10-01', ...fields }) as any;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T15:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('Atendimento e normalização', () => {
  it('preserva crédito, dono, data da edição e protocolo com espaços', () => {
    const c = processarCaso(base({ protocolo: 'SOLICITAR O Nº PROCESSO', created_by: 'dono-1', atendido_por: 'supervisor-2', atendido_em: '2026-09-14T14:00:00Z', edited_at: '2026-09-13T12:00:00Z' }));
    expect(c.protocolo).toBe('SOLICITAR O Nº PROCESSO');
    expect(c.created_by).toBe('dono-1');
    expect((c as any).atendido_por).toBe('supervisor-2');
    expect((c as any).atendido_em).toBe('2026-09-14T14:00:00Z');
    expect((c as any).edited_at).toBe('2026-09-13T12:00:00Z');
  });
  it('não ressuscita prazo removido usando alias antigo de planilha', () => {
    const c = processarCaso(base({ proximoPrazo: '', PROXIMOPRAZO: '2026-01-01', PRAZO: '2026-01-01', ultimoRetorno: '2026-09-14', ULTIMORETORNO: '2026-01-01' }));
    expect(c.proximoPrazo).toBe('');
    expect(c.ultimoRetorno).toBe('2026-09-14');
  });
  it('encerrado não fica vencido mesmo com prazo antigo e marcador crítico', () => {
    const c = base({ situacao: 'ENCERRADO', proximoPrazo: '2020-01-01', statusManual: 'Caso Crítico' });
    expect(statusEfetivo(c)).toBe('Encerrado');
    expect(statusEfetivo(processarCaso(c))).toBe('Encerrado');
  });
  it('atendimento quita novidade antiga; evento posterior abre novamente', () => {
    const c = base({ tem_novo_andamento: true, atendido_em: '2026-09-14T13:00:00Z', evento_data: '2026-09-13' });
    expect(resolveTemNovoAndamento(c)).toBe(false);
    expect(resolveTemNovoAndamento({ ...c, evento_data: '2026-09-14T14:00:00Z' })).toBe(true);
    expect(resolveTemNovoAndamento({ ...c, evento_data: undefined })).toBe(false);
  });
});

describe('Busca e apreensão e risco', () => {
  it.each([
    ['Revisional', 'Defiro a busca e apreensão do veículo.', false],
    ['Busca e Apreensão', 'Jurisprudência: defiro a busca e apreensão do veículo.', false],
    ['Busca e Apreensão', 'Indefiro a busca e apreensão do veículo.', false],
    ['Busca e Apreensão', 'Baixa definitiva.', false],
    ['Busca e Apreensão', 'Ante o exposto, defiro a busca e apreensão do veículo.', true],
    ['Busca e Apreensão', 'Mandado de busca expedido', true],
  ])('classe %s e teor %s', (classe_acao, evento_resumo, expected) => {
    expect(isBuscaApreensaoReal(base({ classe_acao, evento_resumo, indicio_busca_apreensao: true }))).toBe(expected);
  });
  it('só vincula alerta forte ao número oficial da publicação', () => {
    const opts = { texto: 'Defiro a busca e apreensão do veículo.', classe: 'Busca e Apreensão', processoDjen: '20000001220268260100', tribunalSigla: 'TJSP', protocolosCarteira: [cnj] };
    expect(detectarBaCompleto(opts).alertarOperacional).toBe(false);
    expect(detectarBaCompleto({ ...opts, processoDjen: cnj }).alertarOperacional).toBe(true);
    expect(publicacaoBateComCarteira({ ...opts, clienteNome: 'Pessoa sem vínculo' }).ok).toBe(false);
  });
  it('deduplica CNJ por atualização e mantém registros sem CNJ separados', () => {
    const rows = [base({ updated_at: '2026-01-01' }), base({ id: '2', protocolo: cnj.replace(/\D/g, ''), updated_at: '2026-02-01' }), base({ id: '3', protocolo: 'SOLICITAR Nº PROCESSO' }), base({ id: '4', protocolo: 'SOLICITAR Nº PROCESSO' })];
    expect(uniqueCases(rows).map(c => c.id)).toEqual(['2', '3', '4']);
    expect(uniqueCases([...rows].reverse()).find(c => c.protocolo === cnj.replace(/\D/g, ''))?.id).toBe('2');
  });
  it('baixa isolada não aumenta risco nem encerra a carteira', () => {
    const c = base({ datajud_encerrado_tribunal: true, evento_tipo: 'transito_ou_baixa', indicio_busca_apreensao: true });
    const k = computeKpiUnificado([c]);
    expect(k.activeTotal).toBe(1);
    expect(k.countBA).toBe(0);
    expect(k.riskScore).toBe(0);
    expect(k.countEncerradoCarteira).toBe(0);
  });
  it('não soma o mesmo caso várias vezes; painel e dossiê concordam', () => {
    const cases = [base({ proximoPrazo: '2026-01-01', classe_acao: 'Busca e Apreensão', evento_resumo: 'Defiro a busca e apreensão.' }), base({ id: '2', protocolo: '20000001220268260100' }), base({ id: '3', protocolo: '30000001220268260100', situacao: 'ENCERRADO' })];
    const k = computeKpiUnificado(cases);
    expect(k.total).toBe(k.activeTotal + k.countEncerradoCarteira);
    expect(k.riskScore).toBe(50);
    const dashboard = buildDashboardMetrics(cases);
    expect(dashboard.riskScore).toBe(k.riskScore);
    expect(dashboard.riskExplanation.score).toBe(k.riskScore);
    expect(dashboard.riskExplanation.label).toBe(k.riskLabel);
  });
});

describe('Consulta DJEN', () => {
  it('fatia 966 dias sem lacunas, sobreposição ou janelas acima de 30 dias', () => {
    const windows = splitDjenDateRange('2024-01-01', '2026-08-23');
    const dates = windows.flatMap(w => { const d: number[] = []; for (let t = Date.parse(w.inicio); t <= Date.parse(w.fim); t += 86400000) d.push(t); expect(d.length).toBeLessThanOrEqual(30); return d; });
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.length).toBe((Date.parse('2026-08-23') - Date.parse('2024-01-01')) / 86400000 + 1);
  });
  it.each([['2026-09-14', '2026-09-13'], ['2026-02-30', '2026-03-01'], ['', '2026-09-14']])('recusa intervalo inválido %s/%s', (a, b) => expect(() => splitDjenDateRange(a, b)).toThrow());
  it('respeita Retry-After e aumenta a espera', () => {
    expect(djenRetryDelay(0, '45')).toBe(45000);
    expect(djenRetryDelay(2)).toBeGreaterThan(djenRetryDelay(1));
    expect(djenRetryDelay(0, '120')).toBe(120000);
  });
  it('interrompe a espera ao parar a busca', async () => {
    const controller = new AbortController();
    const waiting = waitForDjen(60000, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toHaveProperty('name', 'AbortError');
  });
});
