import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getHermesNationalSourcePlan,classifyHermesOfficialFallback,resolveOfficialCourtPortal} from '@/lib/hermes-official-fallbacks';

const num=(j:string,t:string)=>'1234567892026'+j+t+'0001';

describe('Hermes nacional: fontes oficiais por jurisdição e escalonamento',()=>{
 it('cobre todos os 27 tribunais estaduais sem confundir TJ com outros ramos',()=>{
  for(let i=1;i<=27;i++){
   const number=num('8',String(i).padStart(2,'0'));
   const plan=getHermesNationalSourcePlan(number);
   expect(plan?.alias).toMatch(/^tj[a-z]{2,4}$/);
   expect(plan?.tribunal).toMatch(/^TJ/);
   expect(plan?.automated).toEqual(['DJEN','DataJud']);
  }
  expect(getHermesNationalSourcePlan(num('8','26'))?.alias).toBe('tjsp');
  expect(getHermesNationalSourcePlan(num('8','19'))?.alias).toBe('tjrj');
 });
 it('cobre TRFs 1–6, TRTs 1–24 e STJ, sem assumir API de tribunal liberada',()=>{
  for(let n=1;n<=6;n++)expect(getHermesNationalSourcePlan(num('4',String(n).padStart(2,'0')))?.alias).toBe('trf'+n);
  for(let n=1;n<=24;n++)expect(getHermesNationalSourcePlan(num('5',String(n).padStart(2,'0')))?.alias).toBe('trt'+n);
  expect(getHermesNationalSourcePlan(num('2','00'))?.alias).toBe('stj');
  expect(getHermesNationalSourcePlan(num('3','00'))?.alias).toBe('tst');
  expect(getHermesNationalSourcePlan(num('6','00'))?.alias).toBe('tse');
  expect(getHermesNationalSourcePlan(num('7','00'))?.alias).toBe('stm');
  expect(getHermesNationalSourcePlan(num('8','99'))).toBeNull();
  expect(getHermesNationalSourcePlan('123')).toBeNull();
 });
 it('abre e-SAJ e eproc de SP como alternativas de consulta humana, sem RPA',()=>{
  const plan=getHermesNationalSourcePlan(num('8','26'));
  expect(plan?.tribunalPortal?.url).toContain('tjsp.jus.br');
  expect(plan?.otherPortals.some(p=>p.url.includes('esaj.tjsp.jus.br'))).toBe(true);
  expect(plan?.tribunalApiAutomated).toBe(false);
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
