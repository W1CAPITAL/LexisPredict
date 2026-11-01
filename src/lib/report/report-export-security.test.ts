import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: { value: { auth_id: 'user-a', empresa_id: 'company-a', cargo: 'Operador', isSupervisor: false, isSuperAdmin: false, nome: 'Ana' } as Record<string, unknown> },
  rpc: vi.fn(), render: vi.fn(), supervision: vi.fn(),
}));
vi.mock('@/lib/server-db', () => ({ getUserContext: async () => mocks.context.value, getSupabaseAdmin: async () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/report/report-identity', () => ({ getReportIdentity: async () => ({ company: 'Empresa Aurora', author: 'Ana' }) }));
vi.mock('@/lib/atividades-registradas', () => ({ getAtividadesRegistradasPorResponsavel: async () => ({}) }));
vi.mock('@/components/pdf/report-team-summary-pdf', () => ({ ReportTeamSummaryPdf: () => null }));
vi.mock('@/components/pdf/supervisao-pdf', () => ({ SupervisaoPDF: () => null }));
vi.mock('@/components/pdf/relatorio-equipe-pdf', () => ({ RelatorioEquipePDF: () => null }));
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: mocks.render }));
vi.mock('@/app/actions/supervisao-actions', () => ({ getSupervisaoSnapshotAction: mocks.supervision }));
import { GET as reportPdf } from '@/app/api/report/pdf/route';
import { GET as supervisionPdf } from '@/app/api/supervisao/pdf/route';

describe('isolamento das exportações automáticas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.value = { auth_id: 'user-a', empresa_id: 'company-a', cargo: 'Operador', isSupervisor: false, isSuperAdmin: false, nome: 'Ana' };
    mocks.render.mockResolvedValue(Buffer.from('%PDF-' + 'x'.repeat(200)));
    mocks.rpc.mockImplementation(async (name: string) => {
      const data = name === 'lexis_relatorio_equipe_periodo'
        ? { pessoas: [{ userId: 'user-a', nome: 'Ana', atividades: {} }, { userId: 'user-b', nome: 'Bruno', atividades: {} }] }
        : name === 'lexis_portfolio_snapshot' ? [{ total: 3, ativos: 2, encerrados: 1 }]
          : name === 'lexis_atividade_kpis_periodo' ? { dias: [], porUsuario: [], porUsuarioDia: [{ userId: 'user-a', ymd: '2026-10-31', eventos: 1 }, { userId: 'user-b', ymd: '2026-10-31', eventos: 9 }] } : {};
      return { data, error: null };
    });
  });
  it('exige autenticação antes de consultar ou renderizar', async () => {
    mocks.context.value = {};
    expect((await reportPdf(new Request('https://example.com/api/report/pdf'))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('não permite que operador force o escopo da empresa', async () => {
    expect((await reportPdf(new Request('https://example.com/api/report/pdf?escopo=empresa'))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('ignora empresa e usuário forjados e remove colegas do PDF pessoal', async () => {
    mocks.context.value.cargo = 'Administrador';
    const result = await reportPdf(new Request('https://example.com/api/report/pdf?escopo=meus&empresa_id=company-b&usuario=user-b'));
    expect(result.status).toBe(200);
    for (const [, args] of mocks.rpc.mock.calls) expect(args.p_empresa).toBe('company-a');
    const element = mocks.render.mock.calls[0][0];
    expect(element.props.data.pessoas.map((p: { userId: string }) => p.userId)).toEqual(['user-a']);
    expect(element.props.daily.map((p: { userId: string }) => p.userId)).toEqual(['user-a']);
    expect(element.props.company).toBe('Empresa Aurora');
    expect(result.headers.get('cache-control')).toContain('private, no-store');
  });
  it('bloqueia exportação da supervisão para operador e visualizador', async () => {
    for (const cargo of ['Operador', 'Visualizador']) {
      mocks.context.value.cargo = cargo;
      expect((await supervisionPdf(new Request('https://example.com/api/supervisao/pdf'))).status).toBe(403);
    }
    expect(mocks.supervision).not.toHaveBeenCalled();
  });
  it('o supervisor recebe um snapshot novo, limitado ao período aceito', async () => {
    mocks.context.value = { ...mocks.context.value, cargo: 'Supervisor', isSupervisor: true };
    mocks.supervision.mockResolvedValue({ success: true, snapshot: { empresaNome: 'Empresa Aurora', geradoEm: '2026-10-31' } });
    const result = await supervisionPdf(new Request('https://example.com/api/supervisao/pdf?periodo=mes&empresa_id=company-b'));
    expect(result.status).toBe(200);
    expect(mocks.supervision).toHaveBeenCalledWith('mes');
    expect(mocks.render.mock.calls[0][0].props.data.empresaNome).toBe('Empresa Aurora');
  });
});
