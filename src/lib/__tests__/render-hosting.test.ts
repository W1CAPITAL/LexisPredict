import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const read=(name:string)=>readFileSync(name,'utf8');
describe('Render full-stack deployment without Vercel function count limits',()=>{
 it('provides a distinct deployment blueprint preserving existing WA worker deployment',()=>{
  const app=read('deploy/render-full-app.yaml');
  const old=read('render.yaml');
  expect(app).toMatch(/name:\s*lexispredict-full-app/);
  expect(app).toMatch(/runtime:\s*node/);
  expect(app).toMatch(/plan:\s*free/);
  expect(app).toMatch(/autoDeployTrigger:\s*off/);
  expect(app).toMatch(/buildCommand:[^\n]*pnpm[^\n]*build/);
  expect(app).toMatch(/startCommand:[^\n]*next\s+start/);
  expect(app).toContain('healthCheckPath: /api/health');
  expect(old).toContain('name: lexispredict-wa-auto');
  expect(old).not.toContain('name: lexispredict-full-app');
 });
 it('requires critical credentials but never commits secret values',()=>{
  const app=read('deploy/render-full-app.yaml');
  for(const key of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET','WA_DAILY_CRON_SECRET']){
   expect(app).toContain('key: '+key);
  }
  expect(app).not.toMatch(/\bSUPABASE_SERVICE_ROLE_KEY\s*\n\s*value:/);
  expect(app).not.toMatch(/\bWA_DAILY_CRON_SECRET\s*\n\s*value:/);
  expect(app).not.toMatch(/sync:\s*true/);
 });
 it('documents unavoidable cold starts and the need to move scheduled requests before production',()=>{
  const doc=read('docs/render-full-app.md');
  expect(doc).toContain('15 minutos');
  expect(doc).toContain('12 funções');
  expect(doc).toContain('pg_cron');
  expect(doc).toContain('/api/health');
  expect(doc).toContain('deploy/render-full-app.yaml');
 });
});
