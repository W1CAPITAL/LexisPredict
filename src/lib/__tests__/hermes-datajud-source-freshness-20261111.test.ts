import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fetchDataJud} from '@/lib/datajud';
import {extractDataJudSourceRevision,retainDataJudSourceRevision} from '@/lib/datajud-source-freshness';

const cnj='00008323520184013202';
afterEach(()=>vi.unstubAllGlobals());
const read=(p:string)=>readFileSync(p,'utf8');

describe('Hermes: origem temporal DataJud e falhas parciais',()=>{
 it('preserva metadados de atualização e indexação distintos da consulta',()=>{
  expect(extractDataJudSourceRevision({
   found:true,error:false,
   indexadoEm:'2026-11-11T12:30:00Z',
   dataHoraUltimaAtualizacao:'2026-11-10T20:15:22.000Z',
  })).toEqual({
   indexedAt:'2026-11-11T12:30:00.000Z',
   updatedAt:'2026-11-10T20:15:22.000Z',
  });
 });
 it('não inventa timestamps sem evidência ou usa dados de consulta falha',()=>{
  expect(extractDataJudSourceRevision({error:true,found:false,indexadoEm:'2026-11-11T00:00:00Z'})).toBeNull();
  expect(extractDataJudSourceRevision({error:false,found:true,indexadoEm:'invalido',dataHoraUltimaAtualizacao:null})).toEqual({indexedAt:null,updatedAt:null});
 });
 it('uma execução DJEN-only ou 429 conserva a última revisão DataJud confirmada',()=>{
  const earlier={indexedAt:'2026-11-09T18:00:00.000Z',updatedAt:'2026-11-08T09:00:00.000Z'};
  expect(retainDataJudSourceRevision(earlier,null)).toEqual(earlier);
  expect(retainDataJudSourceRevision(earlier,{indexedAt:'2026-11-10T10:00:00.000Z',updatedAt:null}))
   .toEqual({indexedAt:'2026-11-10T10:00:00.000Z',updatedAt:'2026-11-08T09:00:00.000Z'});
 });
 it('não confirma índice parcialmente indisponível com shards failed mesmo havendo hit',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
   ok:true,status:200,headers:{get:()=>null},
   json:async()=>({timed_out:false,_shards:{total:4,successful:3,failed:1},hits:{hits:[{_source:{
    numeroProcesso:cnj,movimentos:[{nome:'Sentença',dataHora:'2026-11-11T10:00:00Z'}]
   }}]}})
  }));
  const r=await fetchDataJud(cnj,1,{cloudBudget:true,forceRefresh:true,timeoutMs:5000});
  expect(r.error).toBe(true);
  expect(r.errorCode).toBe('shard_failure');
  expect(r.found).not.toBe(true);
 });
 it('o Hermes guarda os metadados de origem no dossiê e separa confirmação atual de origem histórica',()=>{
  const service=read('src/lib/hermes-return-service.ts');
  expect(service).toContain('extractDataJudSourceRevision');
  expect(service).toContain('retainDataJudSourceRevision');
  expect(service).toContain('datajud_indexed_at');
  expect(service).toContain('datajud_updated_at');
  expect(service).toContain('datajudIndexedAt');
  expect(service).toContain('datajudUpdatedAt');
 });
 it('a migração mantém RLS e não torna metadados de processos públicos anonimamente acessíveis',()=>{
  const sql=read('supabase/migrations/20261111161000_hermes_datajud_source_freshness.sql');
  expect(sql).toContain('datajud_indexed_at');
  expect(sql).toContain('datajud_updated_at');
  expect(sql).not.toContain('grant select');
  expect(sql).not.toContain('disable row level security');
 });
 it('painel Hermes separa data da consulta e data informada pelo indexador CNJ',()=>{
  const svc=read('src/lib/hermes-company-service.ts');
  const ui=read('src/components/hermes/hermes-portfolio-monitoring.tsx');
  expect(svc).toContain('datajudIndexedAt');
  expect(svc).toContain('datajudUpdatedAt');
  expect(svc).toContain('datajud_indexed_at');
  expect(svc).toContain('datajud_updated_at');
  expect(ui).toContain('Indexado no DataJud');
  expect(ui).toContain('Atualização declarada pelo CNJ');
 });
});
