import { describe, expect, it } from 'vitest';
import { canAccessExistingCase } from './case-edit-access';

const makeCtx = (cargo: string, empresa = 'empresa-1', auth = 'auth-1') => ({
  auth_id: auth,
  empresa_id: empresa,
  cargo,
  isViewer: cargo === 'Visualizador',
  isSuperAdmin: cargo === 'Superadmin',
  isSupervisor: cargo === 'Supervisor',
});

const processo = (status: string, owner = 'auth-2', empresa = 'empresa-1') => ({
  empresa_id: empresa,
  created_by: owner,
  status,
  status_interno: status,
  dados: { situacao: status },
});

describe('case edit permission - closed cases in /processos', () => {
  it('allows administrators to edit/attend closed cases from the same company', async () => {
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('Encerrado'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('ARQUIVADO', ''))).toBe(true);
  });
  it('keeps administrators restricted to their own active cases', async () => {
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('EM ANDAMENTO'))).toBe(false);
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('EM ANDAMENTO', 'auth-1'))).toBe(true);
  });
  it('prevents cross-company access for any role', async () => {
    for (const cargo of ['Superadmin', 'Supervisor', 'Administrador', 'Operador']) {
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('ENCERRADO', 'auth-1', 'empresa-2'))).toBe(false);
    }
  });
  it('retains operator ownership and viewer read-only restrictions', async () => {
    expect(await canAccessExistingCase(makeCtx('Operador') as any, processo('ENCERRADO'))).toBe(false);
    expect(await canAccessExistingCase(makeCtx('Operador') as any, processo('ENCERRADO', 'auth-1'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Visualizador') as any, processo('ENCERRADO', 'auth-1'))).toBe(false);
  });
  it('permits supervisors and superadmins for active and closed own-company cases', async () => {
    for (const cargo of ['Superadmin','Supervisor']) {
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('EM ANDAMENTO'))).toBe(true);
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('ENCERRADO', ''))).toBe(true);
    }
  });
});
