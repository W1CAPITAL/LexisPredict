import {describe,it,expect} from 'vitest';
import {evaluateHermesStalledEvidence} from '@/lib/hermes-stalled-evaluation';

describe('Hermes: publicação no DJEN não é movimentação no tribunal',()=>{
 const today='2026-11-10';
 it('com apenas DJEN, registra publicação e consulta parcial, não confirma processo movimentado',()=>{
  const result=evaluateHermesStalledEvidence({
   today,datajudOk:false,djenOk:true,lastKnownDataJudMove:null,lastKnownDjenPublication:null,
   events:[{source:'DJEN',at:'2026-11-09',text:'Intimação publicada',url:null}]
  });
  expect(result.state).toBe('partial');
  expect(result.lastMovementAt).toBeNull();
  expect(result.lastPublicationAt).toBe('2026-11-09');
  expect(result.daysWithoutMovement).toBeNull();
 });
 it('com DataJud e DJEN confirmados, baseia paralisação somente em movimentos do DataJud',()=>{
  const result=evaluateHermesStalledEvidence({
   today,datajudOk:true,djenOk:true,lastKnownDataJudMove:'2026-09-01',lastKnownDjenPublication:null,
   events:[{source:'DJEN',at:'2026-11-10',text:'Publicação da sentença',url:null},
    {source:'DataJud',at:'2026-09-01',text:'Conclusão',url:null}]
  });
  expect(result.state).toBe('confirmed_idle');
  expect(result.lastMovementAt).toBe('2026-09-01');
  expect(result.lastPublicationAt).toBe('2026-11-10');
 });
 it('com ambas APIs indisponíveis, exige nova consulta sem alegar ausência de movimentação',()=>{
  const result=evaluateHermesStalledEvidence({
   today,datajudOk:false,djenOk:false,lastKnownDataJudMove:'2026-09-01',lastKnownDjenPublication:'2026-09-10',events:[]
  });
  expect(result.state).toBe('unavailable');
 });
 it('movimentação mais nova verificada pelo DataJud impede falso parado',()=>{
  const result=evaluateHermesStalledEvidence({
   today,datajudOk:true,djenOk:true,lastKnownDataJudMove:null,lastKnownDjenPublication:null,
   events:[{source:'DataJud',at:'2026-11-09',text:'Juntada',url:null}]
  });
  expect(result.state).toBe('recent_movement');
  expect(result.daysWithoutMovement).toBe(1);
 });
});
