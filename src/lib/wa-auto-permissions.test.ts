import { describe, expect, it } from 'vitest';
import { resolveWaAutoPermissions } from './wa-auto-permissions';

describe('WA.Auto W1 session management permissions', () => {
  it('recognises Superadmin even when legacy role says operador', () => {
    expect(resolveWaAutoPermissions({cargo: 'Superadmin', role: 'operador'}))
      .toEqual({role: 'Superadmin', canManage: true});
  });
  it('recognises Supervisor and Administrador despite mismatched legacy role', () => {
    expect(resolveWaAutoPermissions({cargo: 'Supervisor', role: 'operador'}).canManage).toBe(true);
    expect(resolveWaAutoPermissions({cargo: 'Administrador', role: 'operador'}).canManage).toBe(true);
  });
  it('does not elevate an operator from an inconsistent role field', () => {
    expect(resolveWaAutoPermissions({cargo: 'Operador', role: 'superadmin'}))
      .toEqual({role: 'Operador', canManage: false});
    expect(resolveWaAutoPermissions({cargo: 'Visualizador', role: 'Administrador'}).canManage).toBe(false);
  });
  it('falls back only when cargo does not contain a known role', () => {
    expect(resolveWaAutoPermissions({cargo: null, role: 'superadmin'}).canManage).toBe(true);
    expect(resolveWaAutoPermissions({cargo: '', role: 'operador'}).canManage).toBe(false);
    expect(resolveWaAutoPermissions({cargo: 'Desconhecido', role: 'Visualizador'}).canManage).toBe(false);
    expect(resolveWaAutoPermissions(null).canManage).toBe(false);
  });
});
