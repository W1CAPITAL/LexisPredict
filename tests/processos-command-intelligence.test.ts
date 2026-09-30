import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processOperationalCoverage,
  processSourceGapCount,
  processSourceMatrix,
  recommendedProcessActions,
} from '../src/lib/processos-command-intelligence';

const base:any={
  protocolo:'0000000-00.2026.8.26.0001',
  cliente:'Cliente Teste',
  status:'No Prazo',
  datajud_consultado_em:new Date().toISOString(),
  djen_consultado_em:new Date().toISOString(),
  sistema_nome:'PJe',
  oab:'123456 SP',
  datajud_hash:'abc',
  ultimoRetorno:'25/09/2026',
  proximoPrazo:'30/09/2026',
  created_by:'user-1'
};

test('process source matrix separates official, operational and snapshot evidence',()=>{
  const rows=processSourceMatrix(base);
  assert.equal(rows.length,6);
  assert.equal(rows.find(x=>x.id==='datajud')?.category,'oficial');
  assert.equal(rows.find(x=>x.id==='djen')?.category,'oficial');
  assert.equal(rows.find(x=>x.id==='snapshot')?.category,'evidencia');
  assert.equal(rows.find(x=>x.id==='operacao')?.category,'operacional');
  assert.equal(processSourceGapCount(base),0);
  assert.equal(processOperationalCoverage(base),100);
});

test('source gaps identify stale or absent judicial sources',()=>{
  const c:any={...base,datajud_consultado_em:'2025-01-01',djen_consultado_em:null,datajud_hash:null,oab:null};
  assert.ok(processSourceGapCount(c)>=3);
  assert.ok(processOperationalCoverage(c)<100);
  const actions=recommendedProcessActions(c);
  assert.ok(actions.some(x=>/Completar fontes/i.test(x.title)));
});

test('new DJEN or post-return movement becomes an actionable recommendation',()=>{
  const c:any={
    ...base,
    djen_nova_comunicacao:true,
    djen_ultimo_resumo:'INTIMAÇÃO para manifestação',
    tem_atualizacao_pos_retorno:true,
  };
  const actions=recommendedProcessActions(c);
  assert.ok(actions.some(x=>/DJEN/i.test(x.title)));
  assert.ok(actions.some(x=>/cliente após novidade/i.test(x.title)));
});

test('critical return is prioritized before calm-state fallback',()=>{
  const c:any={...base,status:'Vencido',diasFaltando:-2};
  const actions=recommendedProcessActions(c);
  assert.equal(actions[0].tone,'red');
  assert.match(actions[0].title,/vencido/i);
});
