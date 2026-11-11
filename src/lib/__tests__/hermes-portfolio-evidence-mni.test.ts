import {describe,it,expect} from 'vitest';
import {mergeHermesCourtHistory,buildHermesVerifiedProcessPatch} from '@/lib/hermes-portfolio-evidence';
import type {HermesCourtSnapshot,HermesCourtEvent} from '@/lib/hermes-return-policy';

const event:HermesCourtEvent={
 source:'TJPR PROJUDI',at:'2026-11-11',text:'Concedida justiça gratuita',
 url:'https://consulta.tjpr.jus.br/projudi_consulta/',
};

describe('Hermes: persistência da fonte MNI do TJPR',()=>{
 it('preserva eventos PROJUDI no histórico cumulativo sem reclassificá-los como DataJud',()=>{
  const events=mergeHermesCourtHistory([], [event]);
  expect(events).toHaveLength(1);
  expect(events[0].source).toBe('TJPR PROJUDI');
 });
 it('atualiza a última movimentação genérica com o MNI, sem preencher campos exclusivos do DataJud',()=>{
  const snapshot:HermesCourtSnapshot={
   djenOk:false,datajudOk:false,courtApiOk:true,events:[event],
  };
  const patch=buildHermesVerifiedProcessPatch({
   snapshot,checkedAt:'2026-11-11T15:00:00.000Z',
   lastDataJudMovement:null,lastMovement:'2026-11-10',lastDjenPublication:null,
  });
  expect(patch.ultima_movimentacao).toBe('2026-11-11');
  expect(patch.datajud_ultimo_movimento).toBeUndefined();
  expect(patch.datajud_last_ok).toBeUndefined();
 });
});
