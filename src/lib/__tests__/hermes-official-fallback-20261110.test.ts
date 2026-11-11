import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchDjenComunicacoes} from '@/lib/djen';
import {resolveOfficialCourtPortal} from '@/lib/hermes-official-fallbacks';
import {readFileSync} from 'node:fs';

const cnj='1002670-83.2025.8.26.0271';
const compact='10026708320258260271';
afterEach(()=>vi.unstubAllGlobals());

describe('Hermes: alternativas oficiais sem inventar confirmação',()=>{
 it('faz a segunda grafia somente após um retorno vazio válido no DJEN automático',async()=>{
  const fetcher=vi.fn()
   .mockResolvedValueOnce({ok:true,status:200,json:async()=>({items:[],count:0})})
   .mockResolvedValueOnce({ok:true,status:200,json:async()=>({items:[{
      id:123,numeroProcesso:cnj,texto:'Publicação de intimação',
      data_disponibilizacao:'2026-11-10'
   }],count:1})});
  vi.stubGlobal('fetch',fetcher);
  const result=await fetchDjenComunicacoes(cnj,{cloudBudget:true,hermesDualFormat:true,forceRefresh:true});
  expect(result.success).toBe(true);
  expect(result.items).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[0][0])).toContain('numeroProcesso='+compact);
  expect(String(fetcher.mock.calls[1][0])).toContain('numeroProcesso=1002670-83.2025.8.26.0271');
 });
 it('não tenta outra grafia quando o DJEN pede pausa HTTP 429',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:false,status:429});
  vi.stubGlobal('fetch',fetcher);
  const result=await fetchDjenComunicacoes(cnj,{cloudBudget:true,hermesDualFormat:true,forceRefresh:true});
  expect(result.success).toBe(false);
  expect(result.isRateLimited).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('não transforma JSON de erro HTTP 200 em DJEN confirmado',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:true,status:200,json:async()=>({status:'error',message:'unavailable'})
  }));
  const result=await fetchDjenComunicacoes(cnj,{cloudBudget:true,hermesDualFormat:true,forceRefresh:true});
  expect(result.success).toBe(false);
 });
 it('aponta somente portais oficiais conhecidos para a consulta de movimentações',()=>{
  expect(resolveOfficialCourtPortal(cnj)?.url).toContain('tjsp.jus.br');
  expect(resolveOfficialCourtPortal('1005530-76.2024.8.26.0082')?.label).toContain('TJSP');
  expect(resolveOfficialCourtPortal('3009295-93.2026.8.19.0066')?.url).toContain('tjrj.jus.br');
  expect(resolveOfficialCourtPortal('1001218-36.2026.5.02.0040')?.url).toContain('trt2.jus.br');
  expect(resolveOfficialCourtPortal('1234567-89.2026.8.99.0001')).toBeNull();
 });
 it('oferece consulta isolada pelo navegador sem alterar a revisão judicial salva',()=>{
  const source=readFileSync('src/components/hermes/hermes-return-review-button.tsx','utf8');
  expect(source).toContain('Consultar somente DJEN');
  expect(source).toContain('djenBuscaProcesso');
  expect(source).toContain('resolveOfficialCourtPortal');
  expect(source).toContain('Consulta pelo navegador, sem alterar a revisão salva');
  expect(source).not.toContain('applyBrowserDjenResultAction');
 });
 it('não presume que publicações do DJEN são uma confirmação de DataJud',()=>{
  const source=readFileSync('src/lib/hermes-return-service.ts','utf8');
  expect(source).toContain('hermesDualFormat:true');
  expect(source).toContain('const datajudOk = !!datajud');
  expect(source).toContain('const djenOk = !!diario');
 });
});