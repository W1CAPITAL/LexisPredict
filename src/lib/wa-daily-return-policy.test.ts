import {describe,expect,it} from 'vitest';
import {isStatusRequest,normalizePhone,prepareDailyReturn,type ReturnCase} from './wa-daily-return-policy';
const base:ReturnCase={
 id:1,empresa_id:'11111111-1111-1111-1111-111111111111',
 cliente:'Maria de Souza',telefone:'(11) 99999-4321',
 protocolo_ref:'1008980-60.2025.8.26.0577',
 ultimo_retorno:'2026-10-07',proximo_retorno:'2026-10-09',status:'EM ANDAMENTO',
 datajud_ultimo_movimento:'2026-10-08T13:20:00Z',
 datajud_ultimo_nome:'Conclusos para julgamento',
 djen_ultima_data:'2026-10-08',djen_ultimo_resumo:'Publicação de intimação para especificação de provas',
 dados:{whatsapp_opt_in:true},
};
describe('retorno inteligente DataJud/DJEN',()=>{
 it('recognizes genuine client questions without treating greetings as commands',()=>{
  expect(isStatusRequest('Qual é a última atualização do meu processo?')).toBe(true);
  expect(isStatusRequest('Houve alguma movimentação no processo?')).toBe(true);
  expect(isStatusRequest('Tem novidade no andamento?')).toBe(true);
  expect(isStatusRequest('bom dia')).toBe(false);
  expect(isStatusRequest('SAIR')).toBe(false);
 });
 it('returns the latest literal movement after the previous return',()=>{
  const x=prepareDailyReturn(base,{mode:'due',today:'2026-10-09'});
  expect(x.reason).toBe('ok');
  expect(x.ready?.message).toContain('Conclusos para julgamento');
  expect(x.ready?.source).toBe('DataJud');
  expect(x.ready?.nextReturn).toBe('2026-10-10');
  expect(x.ready?.message).toContain('07/10/2026');
 });
 it('never sends when the event was already available on previous return',()=>{
  const x=prepareDailyReturn({...base,ultimo_retorno:'2026-10-08'},{mode:'due',today:'2026-10-09'});
  expect(x.reason).toBe('no_new_movement');
 });
 it('does not send if due date is in future',()=>{
  expect(prepareDailyReturn({...base,proximo_retorno:'2026-10-15'},{mode:'due',today:'2026-10-09'}).reason).toBe('not_due');
 });
 it('on client request still requires newer movement',()=>{
  expect(prepareDailyReturn({...base,proximo_retorno:'2026-10-15'},{mode:'requested',today:'2026-10-09'}).reason).toBe('ok');
  expect(prepareDailyReturn({...base,ultimo_retorno:'2026-10-08'},{mode:'requested',today:'2026-10-09'}).reason).toBe('no_new_movement');
 });
 it('rejects claims without comparison date and closed cases',()=>{
  expect(prepareDailyReturn({...base,ultimo_retorno:null},{mode:'due',today:'2026-10-09'}).reason).toBe('missing_return');
  expect(prepareDailyReturn({...base,status:'ENCERRADO'},{mode:'due',today:'2026-10-09'}).reason).toBe('closed');
 });
 it('requires explicit opt-in and honors opt-out',()=>{
  expect(prepareDailyReturn({...base,dados:{}},{mode:'due',today:'2026-10-09'}).reason).toBe('no_consent');
  expect(prepareDailyReturn({...base,dados:{whatsapp_opt_in:true,nao_contatar:true}},{mode:'due',today:'2026-10-09'}).reason).toBe('blocked');
 });
 it('never invents a newer event based on an empty detail',()=>{
  expect(prepareDailyReturn({...base,datajud_ultimo_nome:null,djen_ultimo_resumo:null},{mode:'due',today:'2026-10-09'}).reason).toBe('no_new_movement');
 });
 it('schedules a configurable interval after a confirmed future send',()=>{
  expect(prepareDailyReturn(base,{mode:'single',today:'2026-10-09',intervalDays:7}).ready?.nextReturn).toBe('2026-10-16');
 });
 it('compares Brazilian contact dates at the UTC midnight boundary',()=>{
  expect(prepareDailyReturn({...base,ultimo_retorno:'2026-10-07',datajud_ultimo_movimento:'2026-10-08T01:00:00Z',djen_ultima_data:null},{mode:'single'}).reason).toBe('no_new_movement');
 });
 it('accepts Brazilian date strings and unformatted CNJ without losing the cutoff',()=>{
  expect(prepareDailyReturn({...base,ultimo_retorno:'07/10/2026',protocolo_ref:'10089806020258260577'},{mode:'single'}).reason).toBe('ok');
 });
 it('normalizes Brazilian numbers without guessing missing digits',()=>{
  expect(normalizePhone('(11) 99999-4321')).toBe('5511999994321');
  expect(normalizePhone('1234')).toBe('');
 });
});
