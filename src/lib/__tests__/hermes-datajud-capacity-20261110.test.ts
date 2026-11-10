import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fetchDataJud} from '@/lib/datajud';
const read=(file:string)=>readFileSync(file,'utf8');
const cnj='1002670-83.2025.8.26.0271';
afterEach(()=>vi.unstubAllGlobals());

describe('Hermes: DataJud em sobrecarga oficial',()=>{
 it('identifica HTTP 429 do Elasticsearch, sem alegar processo ausente ou fonte confirmada',async()=>{
  const fetchMock=vi.fn().mockResolvedValue({
   ok:false,status:429,
   headers:{get:(key:string)=>key.toLowerCase()==='retry-after'?'120':null},
  });
  vi.stubGlobal('fetch',fetchMock);
  const result=await fetchDataJud(cnj,1,{forceRefresh:true,fast:true,cloudBudget:true,timeoutMs:5000});
  expect(result.error).toBe(true);
  expect(result.httpStatus).toBe(429);
  expect(result.errorCode).toBe('rate_limited');
  expect(result.retryAfterSeconds).toBe(120);
  expect(result.found).not.toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('não converte timed_out interno da API em sucesso',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
    ok:true,status:200,
    json:async()=>({timed_out:true,_shards:{total:1,successful:0,failed:1},hits:{hits:[]}})
  }));
  const result=await fetchDataJud(cnj,1,{forceRefresh:true,fast:true,cloudBudget:true,timeoutMs:5000});
  expect(result.error).toBe(true);
  expect(result.errorCode).toBe('index_timeout');
  expect(result.found).not.toBe(false);
 });
 it('reserva o acesso ao DataJud por tribunal antes da consulta e informa a pausa ao cliente sem falsificar confirmação',()=>{
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).toContain("rpc('hermes_reserve_datajud_slot'");
  expect(service).toContain("rpc('hermes_finish_datajud_slot'");
  expect(service).toContain('resolveDataJudAlias');
  expect(service).toContain('retry_at');
  expect(service).toContain('DataJud em pausa');
  expect(service).toContain('fetchDjenComunicacoes(cnj');
  expect(service).toContain('datajudOk:false');
 });
 it('tem cooldown atômico para processos paralelos sem expor RPC ao navegador',()=>{
  const sql=read('supabase/migrations/20261110220000_hermes_datajud_capacity.sql');
  expect(sql).toContain('create table if not exists public.hermes_datajud_capacity');
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('hermes_reserve_datajud_slot');
  expect(sql).toContain('hermes_finish_datajud_slot');
  expect(sql).toContain('on conflict');
  expect(sql).toContain("grant execute on function public.hermes_reserve_datajud_slot(text) to service_role");
  expect(sql).toContain("revoke all on function public.hermes_reserve_datajud_slot(text) from public, anon, authenticated");
 });
 it('mostra quando uma consulta a processo parado foi limitada e não escreve atendimento',()=>{
  const ui=read('src/components/hermes/hermes-stalled-monitoring.tsx');
  expect(ui).toContain('sourceErrors.datajud');
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).not.toContain('sendWhatsApp');
 });
});