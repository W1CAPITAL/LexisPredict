import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Contract regression: verify the actual Server Action, not merely a role helper.
// This is intentionally static: do not execute production writes in unit tests.
const file=readFileSync(resolve(process.cwd(),'src/app/actions/case-actions.ts'),'utf8');
const section=file.split('export async function reclassificarExecutivoCarteiraAction()')[1]
  ?.split('export async function batchScanExecutivoAction(')[0]||'';

describe('P0: reclassificação operacional de toda a empresa',()=>{
  it('validates session and company and never scopes the batch to its owner',()=>{
    expect(section).toContain('canOperateCompanyCases(ctx)');
    expect(section).toContain(".eq('empresa_id', empresa_id)");
    expect(section).not.toMatch(/\.eq\(\s*['"]created_by['"]\s*,\s*auth_id\s*\)/);
    expect(section).not.toMatch(/resolveCaseScope\(/);
  });
  it('bounds read pages deterministically and scopes every write to the tenant',()=>{
    expect(section).toContain(".order('id', { ascending: true })");
    const writes=(section.match(/\.from\('processos'\)\.update\(|\.from\('processos'\)\s*\n\s*\.update\(/g)||[]);
    const gated=(section.match(/\.eq\('empresa_id', empresa_id\)/g)||[]);
    expect(writes.length).toBe(2);
    expect(gated.length).toBeGreaterThanOrEqual(writes.length+1);
  });
  it('credits automated batch to the real actor, preserving owner and attendance',()=>{
    expect(section).toContain('authUserId:auth_id');
    expect(section).toContain("protocolo:'CARTEIRA-EMPRESA'");
    expect(section).not.toMatch(/update\(\s*\{[^}]*created_by/);
    expect(section).not.toMatch(/update\(\s*\{[^}]*atendido_por/);
  });
});
