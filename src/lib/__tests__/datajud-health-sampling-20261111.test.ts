import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {selectDataJudHealthSamples} from '@/lib/datajud-health-sampling';
const first='00008323520184013202'; // TRF1, 4.01
const second='1002670-83.2025.8.26.0271'; // TJSP, 8.26
const third='0068497-95.2026.8.16.0014'; // TJPR, 8.16

describe('Rede Judicial: auditoria DataJud sem falsa taxa de sucesso',()=>{
 it('usa somente um CNJ de cada tribunal e limita a três probes',()=>{
  expect(selectDataJudHealthSamples([first,first,second,second,third,'123'],3)).toEqual([
   {cnj:first,courtCode:'4.01'},
   {cnj:'10026708320258260271',courtCode:'8.26'},
   {cnj:'00684979520268160014',courtCode:'8.16'},
  ]);
 });
 it('nunca usa o código do foro (últimos 4 dígitos) como tribunal',()=>{
  expect(selectDataJudHealthSamples([second],3)[0]?.courtCode).toBe('8.26');
 });
 it('não dispara consulta para protocolo inválido nem ultrapassa limite de duas amostras',()=>{
  expect(selectDataJudHealthSamples(['texto','123',first,second,third],2)).toHaveLength(2);
  expect(selectDataJudHealthSamples(['inexistente'],3)).toEqual([]);
 });
 it('na Rede Judicial mede só DataJud com consulta própria e não o scanner híbrido completo',()=>{
  const store=readFileSync('src/store/use-datajud-scan-store.ts','utf8');
  const segment=store.slice(store.indexOf('runInitialHealthCheck: async (protocols)'),store.indexOf('restoreCloudScan: (empresaId,userId)'));
  expect(segment).toContain('selectDataJudHealthSamples');
  expect(segment).toContain("'/api/datajud-search'");
  expect(segment).not.toContain('scanSingleCaseAction');
  expect(segment).not.toContain("mode: 'both'");
  expect(segment).toContain("data?.found===true");
 });
});
