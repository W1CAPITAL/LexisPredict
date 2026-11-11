import {afterEach,describe,expect,it,vi} from 'vitest';
import {
 fetchDataJud,
 resolveDataJudAlias,
 extractDataJudPublicKey,
 normalizeDataJudApiKey,
 searchDataJudByCpf,
 searchDataJudByNome,
} from '@/lib/datajud';

afterEach(()=>{
 vi.unstubAllGlobals();
 vi.unstubAllEnvs();
});

describe('DataJud: consulta pública por CNJ e limites de pesquisa',()=>{
 it('resolve o alias TRF1 a partir do código CNJ, conforme endpoint oficial',()=>{
  expect(resolveDataJudAlias('00008323520184013202')).toBe('trf1');
 });

 it('resolve o alias TJPR para o processo de exemplo do Hermes',()=>{
  expect(resolveDataJudAlias('0068497-95.2026.8.16.0014')).toBe('tjpr');
 });

 it('não escolhe TJSP como fallback para CNJ inválido ou jurisdição desconhecida',()=>{
  expect(resolveDataJudAlias('123')).toBeNull();
  expect(resolveDataJudAlias('00000000000000000000')).toBeNull();
 });

 it('extrai a chave pública publicada na Wiki oficial do CNJ',()=>{
  const html='<p>Authorization: APIKey public-key-value-12345678901234567890==</p>';
  expect(extractDataJudPublicKey(html)).toBe('public-key-value-12345678901234567890==');
 });

 it('normaliza uma chave configurada com ou sem prefixo Authorization/APIKey',()=>{
  expect(normalizeDataJudApiKey(' APIKey abc123== ')).toBe('abc123==');
  expect(normalizeDataJudApiKey('Authorization: APIKey abc123==')).toBe('abc123==');
  expect(normalizeDataJudApiKey('abc123==')).toBe('abc123==');
 });

 it('não tenta pesquisar CPF/CNPJ pela API pública',async()=>{
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  const result=await searchDataJudByCpf('12345678901');
  expect(result.success).toBe(false);
  expect(result.items).toEqual([]);
  expect(result.error).toMatch(/não.*pesquisa.*cpf|cpf.*não.*pesquisa/i);
  expect(fetchMock).not.toHaveBeenCalled();
 });

 it('não tenta pesquisar nome de parte pela API pública',async()=>{
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  const result=await searchDataJudByNome('Maria da Silva');
  expect(result.success).toBe(false);
  expect(result.items).toEqual([]);
  expect(result.error).toMatch(/número.*CNJ|CNJ.*número/i);
  expect(fetchMock).not.toHaveBeenCalled();
 });

 it('não chama o endpoint quando o uso da API não está autorizado',async()=>{
  vi.stubEnv('DATAJUD_USE_AUTHORIZED','false');
  const fetchMock=vi.fn();
  vi.stubGlobal('fetch',fetchMock);
  const result=await fetchDataJud('00008323520184013202',1,{forceRefresh:true,cloudBudget:true});
  expect(result.error).toBe(true);
  expect(result.errorCode).toBe('terms_restricted');
  expect(fetchMock).not.toHaveBeenCalled();
 });

 it('usa o alias correto e o payload CNJ documentado e preserva a data de atualização do índice',async()=>{
  vi.stubEnv('DATAJUD_USE_AUTHORIZED','true');
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
   took:29,timed_out:false,_shards:{total:7,successful:7,skipped:0,failed:0},
   hits:{total:{value:1,relation:'eq'},hits:[{_source:{
    numeroProcesso:'00008323520184013202',tribunal:'TRF1',grau:'JE',
    dataHoraUltimaAtualizacao:'2025-02-11T18:10:28.605Z',
    '@timestamp':'2025-02-27T00:01:02.798609151Z',
    movimentos:[{codigo:26,nome:'Distribuição',dataHora:'2018-10-30T14:06:24.000Z'}],
   }}]},
  }),{status:200,headers:{'content-type':'application/json'}}));
  vi.stubGlobal('fetch',fetchMock);
  const result=await fetchDataJud('00008323520184013202',1,{
   forceRefresh:true,cloudBudget:true,timeoutMs:5000,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url,init]=fetchMock.mock.calls[0];
  expect(String(url)).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search');
  expect(init.headers.Authorization).toMatch(/^APIKey .{20,}$/);
  expect(JSON.parse(String(init.body))).toEqual({
   size:1,query:{match:{numeroProcesso:'00008323520184013202'}},
  });
  expect(result).toMatchObject({
   error:false,found:true,tribunal:'TRF1',
   dataHoraUltimaAtualizacao:'2025-02-11T18:10:28.605Z',
   indexTimestamp:'2025-02-27T00:01:02.798609151Z',
   took:29,shardsFailed:0,
  });
 });
});
