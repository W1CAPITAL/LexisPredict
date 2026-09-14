import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  context: { empresa_id: 'empresa-1', auth_id: 'supervisor-1', nome: 'Supervisora', isViewer: false },
  row: {} as any,
  patches: [] as any[],
  conditions: [] as Array<[string, unknown]>,
  writeError: false,
  conflict: false,
  audit: vi.fn(),
  mirror: vi.fn(),
}));
vi.mock('@/lib/server-db', () => ({
  getUserContext: async () => state.context,
  getProfileByAuthId: async () => null,
  logAuditoriaSistema: state.audit,
  getSupabaseAdmin: async () => ({ from: () => {
    let updating = false;
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => { state.conditions.push([key, value]); return query; },
      order: () => query,
      limit: () => query,
      update: (patch: any) => { updating = true; state.patches.push(patch); return query; },
      maybeSingle: () => query,
      then: (resolve: any, reject: any) => Promise.resolve(updating
        ? { data: state.conflict ? null : { id: 'row-1' }, error: state.writeError ? { message: 'write failed' } : null }
        : { data: state.row ? [state.row] : [], error: null }).then(resolve, reject),
    };
    return query;
  } }),
}));
vi.mock('@/lib/hybrid/sheets-server', () => ({ sheetsServerPost: vi.fn(), sheetsWebhookConfigured: () => true, mirrorAtendimento: state.mirror }));
import { registrarAtendimentoCompletoAction } from './case-save-actions';

beforeEach(() => {
  state.row = { id: 'row-1', protocolo_ref: '1000000-12.2026.8.26.0100', empresa_id: 'empresa-1', created_by: 'operador-2', cliente: 'Cliente', updated_at: '2026-09-01T12:00:00Z', proximo_retorno: '2026-09-15', dados: { situacao: 'EM ANDAMENTO' } };
  state.patches = []; state.conditions = []; state.conflict = false; state.writeError = false;
  state.context.isViewer = false;
  state.audit.mockReset(); state.mirror.mockReset();
  state.mirror.mockResolvedValue({ attempted: true, ok: false, reason: 'Planilha indisponível' });
});

describe('Gravação do atendimento', () => {
  it('grava retorno, próximo passo e crédito real antes do espelho; preserva dono', async () => {
    const result = await registrarAtendimentoCompletoAction({ protocolo: state.row.protocolo_ref, proximoPrazo: '2026-09-22', observacao: 'Retornar na terça.' });
    expect(result.success).toBe(true);
    const patch = state.patches[0];
    expect(patch.ultimo_retorno).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(patch.proximo_retorno).toBe('2026-09-22');
    expect(patch.atendido_por).toBe('supervisor-1');
    expect(patch).not.toHaveProperty('created_by');
    expect(patch.dados.created_by).toBe('operador-2');
    expect(patch.dados.atendimento_sync.state).toBe('pending');
    expect(state.conditions).toContainEqual(['empresa_id', 'empresa-1']);
    expect(state.conditions).toContainEqual(['updated_at', state.row.updated_at]);
    expect(state.mirror).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'supervisor-1', ownerId: 'operador-2', ultimoRetorno: patch.ultimo_retorno, proximoPrazo: '2026-09-22' }));
    expect(state.audit).toHaveBeenCalledTimes(1);
    expect(result.message).toContain('planilha ainda não confirmou');
    expect(result.case?.proximoPrazo).toBe('2026-09-22');
  });
  it('permite remover o próximo retorno sem recuperar o valor antigo', async () => {
    const result = await registrarAtendimentoCompletoAction({ protocolo: state.row.protocolo_ref, proximoPrazo: '' });
    expect(result.success).toBe(true);
    expect(state.patches[0].proximo_retorno).toBeNull();
    expect(result.case?.proximoPrazo).toBe('');
  });
  it.each(['2026-02-30', '31/02/2026', 'amanhã'])('recusa data inválida %s antes de escrever', async proximoPrazo => {
    expect((await registrarAtendimentoCompletoAction({ protocolo: state.row.protocolo_ref, proximoPrazo })).success).toBe(false);
    expect(state.patches).toHaveLength(0);
    expect(state.mirror).not.toHaveBeenCalled();
  });
  it.each(['writeError', 'conflict'] as const)('não confirma nem espelha se houver %s', async flag => {
    state[flag] = true;
    const result = await registrarAtendimentoCompletoAction({ protocolo: state.row.protocolo_ref });
    expect(result.success).toBe(false);
    expect(state.mirror).not.toHaveBeenCalled();
    expect(state.audit).not.toHaveBeenCalled();
  });
  it('não aceita atendimento de perfil somente leitura', async () => {
    state.context.isViewer = true;
    expect((await registrarAtendimentoCompletoAction({ protocolo: state.row.protocolo_ref })).success).toBe(false);
    expect(state.patches).toHaveLength(0);
  });
});
