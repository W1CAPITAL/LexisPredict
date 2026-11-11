import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fetchDataJud,resolveDataJudAlias,searchDataJudByCpf,searchDataJudByNome} from '@/lib/datajud';

const sampleCnj='00008323520184013202';
afterEach(()=>vi.unstubAllGlobals());

describe('Contrato da API pública DataJud (CNJ)',()=>{
 it('resolve exclusivamente o alias documentado do TRF1, sem inventar TJSP para código inválido',()=>{
  expect(resolveDataJudAlias(sampleCnj)).toBe('trf1');
  expect(resolveDataJudAlias('123')).toBe('');
  expect(resolveDataJudAlias('00000000000008990000')).toBe('');
 });
 it('recusa jurisdição não identificada antes de realizar requisição',async()=>{
  const request=vi.fn();
  vi.stubGlobal('fetch',request);
  const value=await fetchDataJud('00000000000008990000',1,{forceRefresh:true,fast:true,cloudBudget:true,timeoutMs:5000});
  expect(value.error).toBe(true);
  expect(value.errorCode).toBe('unknown_jurisdiction');
  expect(request).not.toHaveBeenCalled();
 });
 it('consulta TRF1 por numeroProcesso em 20 dígitos com header APIKey',async()=>{
  const request=vi.fn().mockResolvedValue({
   ok:true,status:200,headers:{get:()=>null},
   json:async()=>({timed_out:false,_shards:{failed:0},hits:{hits:[{_source:{
    numeroProcesso:sampleCnj,tribunal:'TRF1',
    dataHoraUltimaAtualizacao:'2025-02-11T18:10:28.605Z',
    movimentos:[{nome:'Distribuição',dataHora:'2018-10-30T14:06:24Z'}]
   }}]}})
  });
  vi.stubGlobal('fetch',request);
  const found=await fetchDataJud(sampleCnj,1,{forceRefresh:true,cloudBudget:true,fast:true,timeoutMs:5000});
  expect(found.error).toBe(false);
  expect(found.found).toBe(true);
  expect(found.dataHoraUltimaAtualizacao).toBe('2025-02-11T18:10:28.605Z');
  expect(request).toHaveBeenCalledTimes(1);
  const [url,init]=request.mock.calls[0];
  expect(url).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search');
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toMatch(/^APIKey [A-Za-z0-9+/=_-]+$/);
  expect(JSON.parse(init.body)).toMatchObject({query:{match:{numeroProcesso:sampleCnj}}});
 });
 it('descarta hit de outro CNJ, mesmo que Elasticsearch responda 200',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:true,status:200,headers:{get:()=>null},
   json:async()=>({timed_out:false,_shards:{failed:0},hits:{hits:[{_source:{
    numeroProcesso:'00008323520184013203',movimentos:[{nome:'Sentença'}]
   }}]}})
  }));
  const found=await fetchDataJud(sampleCnj,1,{forceRefresh:true,cloudBudget:true,fast:true,timeoutMs:5000});
  expect(found.error).toBe(true);
  expect(found.errorCode).toBe('cnj_mismatch');
  expect(found.found).not.toBe(true);
 });
 it('não envia CPF/CNPJ ou nome da parte como filtro à API pública',async()=>{
  const request=vi.fn(); vi.stubGlobal('fetch',request);
  const byCpf=await searchDataJudByCpf('12345678901');
  const byName=await searchDataJudByNome('Maria Oliveira');
  expect(byCpf.success).toBe(false);
  expect(byName.success).toBe(false);
  expect(byCpf.items).toEqual([]);
  expect(byName.items).toEqual([]);
  expect(request).not.toHaveBeenCalled();
 });
 it('ações de busca usam a carteira local e nunca enviam documentos/nome para DataJud público',()=>{
  const actions=readFileSync('src/app/actions/search-actions.ts','utf8');
  expect(actions).not.toContain('searchDataJudByCpf(');
  expect(actions).not.toContain('searchDataJudByNome(');
  expect(actions).toContain('getStoredCasesForEmpresa');
 });
});
