import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261121220000_restrict_desktop_snapshot_company_scope.sql',
  'utf8',
);

describe('desktop portfolio RPC authorization', () => {
  it('requires an authenticated user bound to a company', () => {
    expect(migration).toContain('v_user uuid := auth.uid()');
    expect(migration).toContain("raise exception 'Sessão inválida'");
    expect(migration).toContain('u.auth_user_id = v_user');
    expect(migration).toContain('u.empresa_id is not null');
  });

  it('reserves the company-wide null owner scope for supervisors and superadmins', () => {
    expect(migration).toContain("v_cargo in ('supervisor', 'supervisao', 'superadmin', 'super admin')");
    expect(migration).toContain("v_role in ('supervisor', 'supervisao', 'superadmin', 'super admin')");
    expect(migration).toContain('if p_owner is null and not v_company_wide then');
    expect(migration).toContain("raise exception 'Escopo empresarial exige Supervisor ou Superadmin'");
  });

  it('does not let a caller select another user and keeps the tenant derived from JWT', () => {
    expect(migration).toContain('if p_owner is not null and p_owner <> v_user then');
    expect(migration).toContain('public.lexis_portfolio_snapshot(v_empresa, p_owner)');
    expect(migration).not.toContain('p_empresa');
  });

  it('keeps the privileged RPC off the anonymous surface', () => {
    expect(migration).toContain('set search_path = pg_catalog, public, pg_temp');
    expect(migration).toContain('revoke all on function public.lexis_desktop_portfolio_snapshot(uuid) from public');
    expect(migration).toContain('revoke all on function public.lexis_desktop_portfolio_snapshot(uuid) from anon');
    expect(migration).toContain('grant execute on function public.lexis_desktop_portfolio_snapshot(uuid) to authenticated, service_role');
  });
});
