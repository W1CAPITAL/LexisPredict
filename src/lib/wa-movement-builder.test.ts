import { describe,expect,it } from 'vitest';
import { prepareMovementAlert, type SourceRow } from './wa-movement-builder';

const base: SourceRow = {
  id:123,empresa_id:'11111111-1111-1111-1111-111111111111',
  cliente:'Cliente Exemplo',telefone:'(11) 99999-1234',
  protocolo_ref:'1234567-89.2026.8.26.0100',
  datajud_ultimo_movimento:'2026-10-04T12:00:00Z',
  datajud_ultimo_nome:'Despacho de mero expediente',
  djen_ultima_data:'2026-10-05',
  djen_ultimo_resumo:'Intimação disponibilizada',
  dados:{},
};
describe('Avisos processuais WA.Auto',()=>{
  it('uses the dated latest verified movement between DJEN and DataJud',()=>{
    const r=prepareMovementAlert(base);
    expect(r.reason).toBe('ok');
    expect(r.alert?.source).toBe('DJEN');
    expect(r.alert?.message).toContain('Intimação disponibilizada');
    expect(r.alert?.message).toContain('05/10/2026');
    expect(r.alert?.phone).toBe('5511999991234');
  });
  it('does not manufacture a movement or date from empty cached data',()=>{
    expect(prepareMovementAlert({...base,datajud_ultimo_nome:null,djen_ultimo_resumo:null}).reason).toBe('event');
    expect(prepareMovementAlert({...base,datajud_ultimo_movimento:null,djen_ultima_data:null}).reason).toBe('event');
  });
  it('requires a valid Brazilian phone',()=>{
    expect(prepareMovementAlert({...base,telefone:'1234'}).reason).toBe('phone');
  });
  it('respects explicit no-contact and denied permission flags',()=>{
    expect(prepareMovementAlert({...base,dados:{nao_contatar:true}}).reason).toBe('blocked');
    expect(prepareMovementAlert({...base,dados:{whatsapp_opt_in:false}}).reason).toBe('blocked');
    expect(prepareMovementAlert({...base,dados:{consentimento_whatsapp:'não'}}).reason).toBe('blocked');
  });
  it('makes stable unique fingerprints for the same process/movement',()=>{
    const a=prepareMovementAlert(base).alert!;
    const b=prepareMovementAlert({...base,cliente:'Cliente Atualizado'}).alert!;
    expect(a.event_hash).toBe(b.event_hash);
    const c=prepareMovementAlert({...base,djen_ultimo_resumo:'Outra intimação'}).alert!;
    expect(c.event_hash).not.toBe(a.event_hash);
  });
  it('ignores future dates instead of stating an unsupported movement',()=>{
    const r=prepareMovementAlert({...base,djen_ultima_data:'2099-01-01'});
    expect(r.alert?.source).toBe('DataJud');
  });
});
