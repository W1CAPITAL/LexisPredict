import { describe,expect,it } from 'vitest';
import { prepareMovementAlert, type SourceRow } from './wa-movement-builder';

const base: SourceRow = {
  id:123,empresa_id:'11111111-1111-1111-1111-111111111111',
  cliente:'Cliente Exemplo',telefone:'(11) 99999-1234',
  protocolo_ref:'1234567-89.2026.8.26.0100',
  datajud_ultimo_movimento:'2026-10-04T12:00:00Z',
  datajud_consultado_em:new Date().toISOString(),
  datajud_ultimo_nome:'Despacho de mero expediente',
  djen_ultima_data:'2026-10-05',
  djen_ultimo_resumo:'Intimação disponibilizada',
  dados:{whatsapp_opt_in:true,wa_djen_evidence:{origin:'official-djen',cnj:'12345678920268260100',eventAt:'2026-10-05',text:'Intimação disponibilizada',checkedAt:new Date().toISOString()}}, ultimo_retorno:'2026-10-01', status:'EM ANDAMENTO',
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
    expect(prepareMovementAlert({...base,datajud_ultimo_nome:null,djen_ultimo_resumo:null}).reason).toBe('no_new_movement');
    expect(prepareMovementAlert({...base,datajud_ultimo_movimento:null,djen_ultima_data:null}).reason).toBe('no_new_movement');
  });
  it('requires a valid Brazilian phone',()=>{
    expect(prepareMovementAlert({...base,telefone:'1234'}).reason).toBe('phone');
  });
  it('respects explicit no-contact and denied permission flags',()=>{
    expect(prepareMovementAlert({...base,dados:{nao_contatar:true}}).reason).toBe('blocked');
    expect(prepareMovementAlert({...base,dados:{whatsapp_opt_in:false}}).reason).toBe('blocked');
    expect(prepareMovementAlert({...base,dados:{consentimento_whatsapp:'não'}}).reason).toBe('blocked');
  });
  it('excludes closed and already-reported events',()=>{
    expect(prepareMovementAlert({...base,status:'ENCERRADO'}).reason).toBe('closed');
    expect(prepareMovementAlert({...base,ultimo_retorno:'2026-10-05'}).reason).toBe('no_new_movement');
    expect(prepareMovementAlert({...base,ultimo_retorno:null}).reason).toBe('missing_return');
  });
  it('accepts documented portfolio consent without overriding refusal',()=>{
    expect(prepareMovementAlert({...base,dados:{wa_djen_evidence:base.dados?.wa_djen_evidence}},true).reason).toBe('ok');
    expect(prepareMovementAlert({...base,dados:{whatsapp_opt_in:false}},true).reason).toBe('blocked');
  });
  it('makes stable unique fingerprints for the same process/movement',()=>{
    const a=prepareMovementAlert(base).alert!;
    const b=prepareMovementAlert({...base,cliente:'Cliente Atualizado'}).alert!;
    expect(a.event_hash).toBe(b.event_hash);
    expect(prepareMovementAlert({...base,djen_ultimo_resumo:'Outro resumo calculado'}).alert!.event_hash).toBe(a.event_hash);
    const c=prepareMovementAlert({...base,dados:{...base.dados,wa_djen_evidence:{...(base.dados!.wa_djen_evidence as object),text:'Outra intimação'}}}).alert!;
    expect(c.event_hash).not.toBe(a.event_hash);
  });
  it('ignores future dates instead of stating an unsupported movement',()=>{
    const r=prepareMovementAlert({...base,djen_ultima_data:'2099-01-01'});
    expect(r.alert?.source).toBe('DataJud');
  });
});
