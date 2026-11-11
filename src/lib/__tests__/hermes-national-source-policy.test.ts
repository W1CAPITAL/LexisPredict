import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {getHermesNationalSourcePlan,classifyHermesOfficialFallback,resolveOfficialCourtPortal} from '@/lib/hermes-official-fallbacks';

const num=(j:string,t:string)=>'1234567892026'+j+t+'0001';
afterEach(()=>vi.unstubAllEnvs());

describe('Hermes nacional: fontes oficiais por jurisdição e escalonamento',()=>{
 it('cobre todos os 27 tribunais estaduais sem confundir TJ com outros ramos',()=>{
  for(let i=1;i<=27;i++){
   const number=num('8',String(i).padStart(2,'0'));
   const plan=getHermesNationalSourcePlan(number);
   expect(plan?.alias).toMatch(/^tj[a-z]{2,4}$/);
   expect(plan?.tribunal).toMatch(/^TJ/);
   expect(plan?.automated).toContain('DJEN');
   expect(plan?.automated).not.toContain('DataJud');
  }
  expect(getHermesNationalSourcePlan(num('8','26'))?.alias).toBe('tjsp');
  expect(getHermesNationalSourcePlan(num('8','19'))?.alias).toBe('tjrj');
 });
 it('mapeia os segmentos superiores conforme a Resolução CNJ 65 e os aliases públicos',()=>{
  for(let n=1;n<=6;n++)expect(getHermesNationalSourcePlan(num('4',String(n).padStart(2,'0')))?.alias).toBe('trf'+n);
  for(let n=1;n<=24;n++)expect(getHermesNationalSourcePlan(num('5',String(n).padStart(2,'0')))?.alias).toBe('trt'+n);
  expect(getHermesNationalSourcePlan(num('2','00'))).toBeNull();
  expect(getHermesNationalSourcePlan(num('3','00'))?.alias).toBe('stj');
  expect(getHermesNationalSourcePlan(num('5','00'))?.alias).toBe('tst');
  expect(getHermesNationalSourcePlan(num('6','00'))?.alias).toBe('tse');
  expect(getHermesNationalSourcePlan(num('7','00'))?.alias).toBe('stm');
  for(let n=1;n<=27;n++)expect(getHermesNationalSourcePlan(num('6',String(n).padStart(2,'0')))?.alias).toMatch(/^tre-/);
  for(let n=1;n<=12;n++)expect(getHermesNationalSourcePlan(num('7',String(n).padStart(2,'0')))?.alias).toBe('stm');
  expect(getHermesNationalSourcePlan(num('9','13'))?.alias).toBe('tjmmg');
  expect(getHermesNationalSourcePlan(num('9','21'))?.alias).toBe('tjmrs');
  expect(getHermesNationalSourcePlan(num('9','26'))?.alias).toBe('tjmsp');
  expect(getHermesNationalSourcePlan(num('1','00'))).toBeNull();
  expect(getHermesNationalSourcePlan(num('4','90'))).toBeNull();
  expect(getHermesNationalSourcePlan(num('5','90'))).toBeNull();
  expect(getHermesNationalSourcePlan('123')).toBeNull();
 });
 it('só anuncia DataJud como fonte automática quando há autorização expressa',()=>{
  vi.stubEnv('DATAJUD_USE_AUTHORIZED','false');
  const regular=getHermesNationalSourcePlan(num('8','26'));
  expect(regular?.automated).not.toContain('DataJud');
  expect(regular?.automated).toContain('DJEN');
  const tjpr=getHermesNationalSourcePlan(num('8','16'));
  expect(tjpr?.automated).toEqual(['DJEN','TJPR PROJUDI MNI']);
  vi.stubEnv('DATAJUD_USE_AUTHORIZED','true');
  expect(getHermesNationalSourcePlan(num('8','26'))?.automated).toContain('DataJud');
 });

 it('abre e-SAJ e eproc de SP como alternativas de consulta humana, sem RPA',()=>{
  const plan=getHermesNationalSourcePlan(num('8','26'));
  expect(plan?.tribunalPortal?.url).toContain('tjsp.jus.br');
  expect(plan?.otherPortals.some(p=>p.url.includes('esaj.tjsp.jus.br'))).toBe(true);
  expect(plan?.tribunalApiAutomated).toBe(false);
  const tjpr=getHermesNationalSourcePlan(num('8','16'));
  expect(tjpr?.tribunalApiAutomated).toBe(true);
  expect(tjpr?.automated).toContain('TJPR PROJUDI MNI');
  expect(tjpr?.tribunalApiAuthRequired).toBe(false);
  expect(resolveOfficialCourtPortal(num('8','26'))?.label).toContain('TJSP');
 });
 it('para tribunais sem portal direto já catalogado, oferece acesso autenticado via Jus.br',()=>{
  const plan=getHermesNationalSourcePlan(num('5','13'));
  expect(plan?.jusbr.url).toBe('https://www.jus.br/');
  expect(plan?.jusbr.authRequired).toBe(true);
  expect(plan?.tribunalApiAutomated).toBe(false);
 });
 it('preserva granularidade das fontes e nunca declara DataJud confirmado a partir do DJEN',()=>{
  expect(classifyHermesOfficialFallback(true,true)).toBe('both-confirmed');
  expect(classifyHermesOfficialFallback(false,true)).toBe('djen-only');
  expect(classifyHermesOfficialFallback(true,false)).toBe('datajud-only');
  expect(classifyHermesOfficialFallback(false,false)).toBe('no-current-source');
 });
 it('torna indisponibilidade de ambas as APIs uma pendência monitorada, não falsa atualização judicial',()=>{
  const service=readFileSync('src/lib/hermes-return-service.ts','utf8');
  const panel=readFileSync('src/components/hermes/hermes-stalled-monitoring.tsx','utf8');
  expect(service).toContain('getHermesNationalSourcePlan');
  expect(service).toContain('classifyHermesOfficialFallback');
  expect(service).toContain('sourceMode');
  expect(service).toContain('fonteAlternativa');
  expect(service).not.toContain('fetchEsaJProcess(');
  expect(panel).toContain('resolveOfficialCourtPortal');
  expect(panel).toContain('Jus.br');
 });
});
