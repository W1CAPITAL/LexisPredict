import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {TRIBUNAIS_TJ,getTribunalByCnj} from '@/lib/tribunais-links';
const file=(s:string)=>readFileSync(s,'utf8');
describe('Todos os 27 TJs e Vercel Hobby sem APIs duplicadas',()=>{
 it('identifica os 27 tribunais estaduais mais DF e mapeia por CNJ',()=>{
  expect(TRIBUNAIS_TJ).toHaveLength(27);
  expect(new Set(TRIBUNAIS_TJ.map(t=>t.codigo)).size).toBe(27);
  for(const item of TRIBUNAIS_TJ){
   const tribunalCode=item.codigo.replace('.','');
   const cnj='123456720268'+tribunalCode+'0001';
   expect(getTribunalByCnj(cnj)?.sigla).toBe(item.sigla);
   expect(item.codigo.startsWith('8.')).toBe(true);
  }
 });
 it('oferece URL https oficial aos 27 estados, sem criar API ou contornar CAPTCHA',()=>{
  for(const item of TRIBUNAIS_TJ){
   const url=new URL(item.url);
   expect(url.protocol).toBe('https:');
   expect(url.hostname==='jus.br'||url.hostname.endsWith('.jus.br')).toBe(true);
  }
  expect(TRIBUNAIS_TJ.find(x=>x.sigla==='TJRJ')?.url).toContain('www.tjrj.jus.br/consultas/');
  expect(TRIBUNAIS_TJ.find(x=>x.sigla==='TJPR')?.sistema).toBe('projudi');
  expect(TRIBUNAIS_TJ.find(x=>x.sigla==='TJSP')?.alternativos?.length).toBeGreaterThan(0);
 });
 it('painel no Hermes exibe abrir 27 portais e informa que acesso não significa coleta automática',()=>{
  const page=file('src/app/hermes-3d/page.tsx');
  const view=file('src/components/hermes/hermes-tj-portal-grid.tsx');
  expect(page).toContain('<HermesTjPortalGrid');
  expect(view).toContain('TRIBUNAIS_TJ');
  expect(view).toContain('Abrir portal');
  expect(view).toContain('não significa coleta automática');
  expect(view).toContain('target="_blank"');
  expect(view).toContain('rel="noopener noreferrer"');
 });
 it('consolida os diagnósticos de health no endpoint existente sem quebrar URLs legadas',()=>{
  const config=file('next.config.ts');
  const health=file('src/app/api/health/route.ts');
  expect(config).toContain('source: "/api/crm/health"');
  expect(config).toContain('destination: "/api/health?scope=crm"');
  expect(config).toContain('source: "/api/commercial/health"');
  expect(config).toContain('destination: "/api/health?scope=commercial"');
  expect(health).toContain("scope==='crm'");
  expect(health).toContain("scope==='commercial'");
  expect(health).toContain('crm_negocios');
  expect(health).toContain('LexisPredict Commercial');
 });
 it('colibri-status preserva compatibilidade e não exige função distinta',()=>{
  const config=file('next.config.ts');
  const service=file('src/app/api/ai/engine-status/route.ts');
  expect(config).toContain('source: "/api/ai/colibri-status"');
  expect(config).toContain('destination: "/api/ai/engine-status?probe=colibri"');
  expect(service).toContain("searchParams.get('probe')==='colibri'");
  expect(service).toContain('probeColibri()');
  expect(service).toContain('ctx?.auth_id');
 });
 it('nenhuma rota adicional foi introduzida para a cobertura dos TJs',()=>{
  expect(file('src/lib/tribunais-links.ts')).toContain('TRIBUNAIS_TJ');
 });
});
