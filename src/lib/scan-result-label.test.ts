import {describe,expect,it} from 'vitest';
import {scanSourceLogMessage} from './scan-result-label';
describe('P0: scanner reports what really ran',()=>{
 it('labels DJEN-only result as a partial scan in Both',()=>{
  expect(scanSourceLogMessage({success:true,datajudOk:false,djenOk:true},'both'))
   .toContain('PARCIAL');
  expect(scanSourceLogMessage({success:true,datajudOk:false,djenOk:true},'both'))
   .toContain('reconsultar DataJud');
 });
 it('full success must have both confirmed and error must remain an error',()=>{
  expect(scanSourceLogMessage({success:true,datajudOk:true,djenOk:true},'both'))
   .toContain('consultas oficiais confirmadas');
  expect(scanSourceLogMessage({success:false,error:'HTTP 429'},'both')).toContain('HTTP 429');
 });
 it('single-source scans only claim their own source',()=>{
  expect(scanSourceLogMessage({success:true,datajudOk:true,djenOk:false},'datajud'))
   .toContain('DataJud: consulta oficial confirmada');
  expect(scanSourceLogMessage({success:true,datajudOk:false,djenOk:true},'djen'))
   .toContain('DJEN: consulta oficial confirmada');
 });
});
