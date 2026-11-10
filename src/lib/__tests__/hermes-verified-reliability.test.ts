import {afterEach,describe,expect,it,vi} from 'vitest';
import {buildHermesVerifiedMeeting,cleanHermesReportText} from '@/lib/hermes-verified-meeting';
import {fetchDataJud} from '@/lib/datajud';

afterEach(()=>vi.unstubAllGlobals());

describe('Hermes: DataJud, atas e vencimentos confiáveis',()=>{
 it('não declara ausência de vencidos quando existe retorno válido pendente',()=>{
  const note=buildHermesVerifiedMeeting({
   active:40,overdue:3,readyReviews:1,unavailableReviews:0,staleSources:0
  },'2026-11-10',null);
  expect(note).toContain('3 retornos');
  expect(note).not.toMatch(/não há retorno vencido/i);
 });
 it('usa somente texto limpo sem asteriscos e sem tabelas Markdown',()=>{
  const text=cleanHermesReportText('**Ata**\n| Indicador | Valor |\n|---|---|\n| Retornos | 0 |');
  expect(text).not.toMatch(/\*\*|\|---|\|/);
  expect(text).toContain('Retornos');
 });
 it('trata timeout interno do índice DataJud como falha, nunca como processo inexistente',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:true,status:200,
   json:async()=>({timed_out:true,_shards:{total:3,successful:1,failed:2},hits:{hits:[]}})
  }));
  const result=await fetchDataJud('1002670-83.2025.8.26.0271',1,{forceRefresh:true,fast:true,cloudBudget:true,timeoutMs:5000});
  expect(result.error).toBe(true);
  expect(result.found).not.toBe(false);
 });
 it('consulta o DataJud pelo formato exato recomendado pelo CNJ, sem alternativa fuzzy em paralelo',async()=>{
  const fn=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({timed_out:false,_shards:{failed:0},hits:{hits:[]}})});
  vi.stubGlobal('fetch',fn);
  await fetchDataJud('1002670-83.2025.8.26.0271',1,{forceRefresh:true,fast:true,cloudBudget:true,timeoutMs:5000});
  const options=fn.mock.calls[0]?.[1] as RequestInit;
  const body=JSON.parse(String(options.body));
  expect(body.query).toEqual({match:{numeroProcesso:'10026708320258260271'}});
 });
});
