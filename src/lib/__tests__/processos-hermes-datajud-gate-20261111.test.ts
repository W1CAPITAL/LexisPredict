import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {formatProcessSourcesLabel, getProcessDataJudStatus, shouldPreservePreviousDataJud} from '@/lib/processos-movement-source-policy';
const read=(p:string)=>readFileSync(p,'utf8');

describe('Hermes · histórico de movimentos DataJud + DJEN sem falso sucesso',()=>{
 it('botão de consulta compartilha gate do Hermes e dá até 45s ao TJSP em vez de 32s',()=>{
  const action=read('src/app/actions/processos-movements-action.ts');
  expect(action).toContain("requestDataJudWithCapacity");
  expect(action).toContain('requestDataJudWithCapacity(cnj,true,45_000)');
  expect(action).not.toContain('page===1?fetchDataJud(cnj');
  expect(action).toContain("page===1");
 });
 it('não marca DataJud como confirmado sem hit exato do CNJ',()=>{
  expect(getProcessDataJudStatus({error:false,found:false,errorCode:'not_found'})).toBe('not_found');
  expect(getProcessDataJudStatus({error:false,found:true,numeroProcesso:'10193368020258260071'},'10193368020258260071')).toBe('confirmed');
  expect(getProcessDataJudStatus({error:false,found:true,numeroProcesso:'11193368020258260071'},'10193368020258260071')).toBe('mismatch');
 });
 it('quando em cooldown não finge timeout nem quebra a consulta DJEN',()=>{
  expect(getProcessDataJudStatus({error:true,errorCode:'cooldown',message:'Em pausa'})).toBe('paused');
  expect(getProcessDataJudStatus({error:true,errorCode:'timeout'})).toBe('timeout');
  expect(formatProcessSourcesLabel({datajud:'paused',djen:'confirmed'})).toContain('DJEN');
  expect(formatProcessSourcesLabel({datajud:'paused',djen:'confirmed'})).toContain('DataJud');
  expect(formatProcessSourcesLabel({datajud:'confirmed',djen:'confirmed'})).toContain('DataJud + DJEN');
 });
 it('preserva últimos movimentos DataJud já confirmados sem atribuir consulta atual',()=>{
  expect(shouldPreservePreviousDataJud(4,'paused')).toBe(true);
  expect(shouldPreservePreviousDataJud(4,'timeout')).toBe(true);
  expect(shouldPreservePreviousDataJud(4,'confirmed')).toBe(false);
  expect(shouldPreservePreviousDataJud(0,'paused')).toBe(false);
 });
 it('a UI mostra falha parcial corretamente e oferece o portal oficial quando o índice não responde',()=>{
  const ui=read('src/components/processos/processos-command-center.tsx');
  expect(ui).toContain('formatProcessSourcesLabel');
  expect(ui).toContain('resolveOfficialCourtPortal');
  expect(ui).toContain('Consulta parcial');
  expect(ui).toContain('Histórico DataJud anterior');
 });
 it('a consulta das páginas adicionais DJEN não repete DataJud',()=>{
  const action=read('src/app/actions/processos-movements-action.ts');
  expect(action).toContain('page===1?requestDataJudWithCapacity(cnj,true,45_000):Promise.resolve(null)');
 });
});
