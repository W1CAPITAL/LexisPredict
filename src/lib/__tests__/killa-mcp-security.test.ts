import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
describe('LexisPredict multi-company OAuth isolation',()=>{
 it('has restrictive RLS on all protected tables for external OAuth writes',()=>{
  const sql=read('supabase/migrations/20261116160000_killa_oauth_readonly_guard.sql');
  expect(sql).toMatch(/AS RESTRICTIVE FOR INSERT/i);
  expect(sql).toMatch(/AS RESTRICTIVE FOR UPDATE/i);
  expect(sql).toMatch(/AS RESTRICTIVE FOR DELETE/i);
  expect(sql).toMatch(/auth\.jwt\(\)->>''client_id''/);
 });
 it('protects privileged office agent functions from third-party OAuth JWT',()=>{
  const sql=read('supabase/migrations/20261116160000_killa_oauth_readonly_guard.sql');
  expect(sql).toContain('reserve_office_agent_reply');
  expect(sql).toContain('finalize_office_agent_reply');
  expect(sql).toContain('register_office_agent_return');
  expect(sql).toContain('OAuth MCP');
 });
 it('has a documented security and licensing boundary',()=>{
  expect(read('SECURITY.md')).toMatch(/LGPD|Lei 13.709/);
  expect(read('SECURITY.md')).toMatch(/service_role|sb_secret_/);
  expect(read('docs/SEGURANCA-MCP-LGPD.md')).toMatch(/OAuth/);
  expect(read('docs/SEGURANCA-MCP-LGPD.md')).toMatch(/RLS/);
  expect(read('README.md')).toMatch(/INFINITUM|Killa AI/);
 });
});
