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
  it('permits administrators to attend active cases from the same company', async () => {
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('EM ANDAMENTO'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Administrador') as any, processo('EM ANDAMENTO', 'auth-1'))).toBe(true);
  });
  it('refuses unauthenticated and company-less writes, including delete/attendance', async () => {
    const item=processo('EM ANDAMENTO','auth-colega','empresa-1');
    expect(await canAccessExistingCase(makeCtx('Operador','empresa-1','') as any,item)).toBe(false);
    expect(await canAccessExistingCase(makeCtx('Visualizador','', 'auth-1') as any,item)).toBe(false);
    expect(await canAccessExistingCase(makeCtx('Administrador') as any,null)).toBe(false);
  });
  it('every tenant role may edit attend and delete colleagues cases, regardless of situation',async()=>{
    for(const cargo of ['Operador','Administrador','Supervisor','Superadmin','Visualizador']){
      for(const status of ['EM ANDAMENTO','ENCERRADO','ARQUIVADO','EXTINTO']){
        const row=processo(status,'auth-outro','empresa-1');
        expect(await canAccessExistingCase(makeCtx(cargo) as any,row)).toBe(true);
      }
    }
  });
  it('prevents cross-company access for any role', async () => {
    for (const cargo of ['Superadmin', 'Supervisor', 'Administrador', 'Operador', 'Visualizador']) {
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('ENCERRADO', 'auth-1', 'empresa-2'))).toBe(false);
    }
  });
  it('allows all tenant members including Visualizador to edit colleagues processes', async () => {
    expect(await canAccessExistingCase(makeCtx('Operador') as any, processo('ENCERRADO'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Operador') as any, processo('ENCERRADO', 'auth-1'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Visualizador') as any, processo('ENCERRADO', 'auth-1'))).toBe(true);
    expect(await canAccessExistingCase(makeCtx('Visualizador') as any, processo('EM ANDAMENTO', 'auth-2'))).toBe(true);
  });
  it('permits supervisors and superadmins for active and closed own-company cases', async () => {
    for (const cargo of ['Superadmin','Supervisor']) {
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('EM ANDAMENTO'))).toBe(true);
      expect(await canAccessExistingCase(makeCtx(cargo) as any, processo('ENCERRADO', ''))).toBe(true);
    }
  });
});
