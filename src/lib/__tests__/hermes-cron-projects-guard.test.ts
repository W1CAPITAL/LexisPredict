import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source=(path:string)=>readFileSync(path,'utf8');
describe('Hermes Cron / Projects no extra serverless functions',()=>{
 it('permits machine-auth meeting cron path at middleware, but not its parent prefix',()=>{
  const middleware=source('middleware.ts');
  const list=middleware.match(/const MACHINE_AUTH_API = new Set\(\[([\s\S]*?)\]\)/)?.[1]||'';
  expect(list).toContain("'/api/cron/hermes-office-meeting'");
  expect(list).toContain("'/api/cron/hermes-returns'");
  expect(middleware).toContain('MACHINE_AUTH_API.has(path)');
  expect(list).not.toContain("'/api/cron/'");
  expect(source('src/app/api/cron/hermes-returns/route.ts')).toContain('authorized(request)');
 });
 it('makes the non-sensitive projects index static without relaxing management role ACL',()=>{
  const page=source('src/app/projetos/page.tsx');
  const middleware=source('middleware.ts');
  expect(page).toContain('Projetos e automações da operação');
  expect(page).not.toContain("getUserContext");
  expect(page).not.toMatch(/dynamic\s*=\s*['"]force-dynamic/);
  expect(middleware).toContain("const MANAGEMENT_ONLY = ['/projetos', '/hermes-3d']");
  expect(middleware).toContain('ROLE_WEIGHT.Administrador');
  expect(middleware).toContain('managementPath');
 });
});
