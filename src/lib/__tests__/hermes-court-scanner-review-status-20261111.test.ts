import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {describeCourtScanner, type CourtScannerView} from '@/lib/hermes-court-scanner-view';
const partial: CourtScannerView = {
 adapter:'tjpr-scmpp',status:'unavailable',httpStatus:500,checkedAt:'2026-11-11T19:39:44Z',
 verifiedAt:null,movements:0,nextAllowedAt:'2026-11-11T23:39:44Z',
 sourceIssueUntil:'2026-11-11T23:39:44Z'
};
describe('Hermes retorno · diagnóstico SCMPP real sem falso sucesso',()=>{
 it('WSDL HTTP 200 não equivale a consulta do tribunal nem movimento confirmado',()=>{
  expect(describeCourtScanner(partial,new Date('2026-11-11T20:00:00Z'))).toMatchObject({
   verified:false,blocked:true,movements:0
  });
 });
 it('pendente sem tentativa indica fila, não sucesso',()=>{
  expect(describeCourtScanner({...partial,status:'pending',checkedAt:null,httpStatus:null},new Date('2026-11-11T20:00:00Z')).verified).toBe(false);
 });
 it('movimentos previamente verificados continuam identificados como históricos quando nova consulta falha',()=>{
  const st=describeCourtScanner({...partial,verifiedAt:'2026-11-01T14:00:00Z',movements:2},new Date('2026-11-11T20:00:00Z'));
  expect(st.verified).toBe(true);expect(st.currentVerified).toBe(false);
 });
 it('fonte retoma sem criar sucesso artificial depois do cooldown',()=>{
  const st=describeCourtScanner(partial,new Date('2026-11-12T00:00:00Z'));
  expect(st.blocked).toBe(false);expect(st.verified).toBe(false);
 });
 it('a consulta autenticada lê apenas registros da própria empresa',()=>{
  const action=readFileSync('src/app/actions/hermes-return-actions.ts','utf8');
  expect(action).toContain("hermes_tribunal_public_movements");
  expect(action).toContain(".eq('empresa_id', empresaId)");
  expect(action).toContain("courtScanner:");
 });
 it('a tela mostra a diferença entre diagnóstico WSDL e scanner automático',()=>{
  const ui=readFileSync('src/components/hermes/hermes-return-review-button.tsx','utf8');
  expect(ui).toContain('Scanner automático do tribunal');
  expect(ui).toContain('Acessar o WSDL não consulta os movimentos do processo');
  expect(ui).toContain('courtScanner');
  expect(ui).toContain('Nenhuma movimentação é confirmada por este teste');
 });
});
