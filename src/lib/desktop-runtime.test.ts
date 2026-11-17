import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const read=(name:string)=>readFileSync(resolve(process.cwd(),name),'utf8');

describe('LexisPredict empacotado na Central de Apps',()=>{
 it('constrói Next standalone somente no canal desktop, sem alterar deploy web',()=>{
  const next=read('next.config.ts');
  expect(next).toContain("LEXIS_DESKTOP_STANDALONE");
  expect(next).toMatch(/output:\s*process\.env\.LEXIS_DESKTOP_STANDALONE/);
  expect(next).toContain("'standalone'");
 });
 it('usa uma rota própria de saúde local com nonce sem expor dados de empresa',()=>{
  const health=read('src/app/api/desktop/health/route.ts');
  expect(health).toContain('LEXIS_DESKTOP_LOCAL_NONCE');
  expect(health).toContain('ready');
  expect(health).not.toContain('service_role');
  expect(health).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  const middleware=read('middleware.ts');
  expect(middleware).toContain("'/api/desktop/health'");
 });
});
