import { describe,expect,it } from 'vitest';
import {preparePublicationNotice,type PublicationSourceRow} from './wa-publication-builder';

const base:PublicationSourceRow={
 id:23,empresa_id:'11111111-1111-1111-1111-111111111111',
 cliente:'Maria da Silva',telefone:'(11) 99999-1234',
 protocolo_ref:'1008980-60.2025.8.26.0577',status:'EM ANDAMENTO',
 datajud_ultimo_movimento:'2026-10-06T12:00:00Z',
 datajud_ultimo_nome:'Certidão de trânsito em julgado',
 djen_ultima_data:'2026-10-06',
 djen_ultimo_resumo:'Sentença julgou parcialmente procedente o pedido',
 dados:{consentimento_whatsapp:true},
};
describe('WA Auto: publicações finais pendentes',()=>{
  it('prepares only an actual dated final entry with clear judgment',()=>{
    const result=preparePublicationNotice(base);
    expect(result.reason).toBe('ok');
    expect(result.notice?.kind).toBe('transito');
    expect(result.notice?.verdict).toBe('parcial');
    expect(result.notice?.message).toContain('parcialmente procedente');
    expect(result.notice?.message).toContain('06/10/2026');
    expect(result.notice?.message).toContain(base.protocolo_ref);
  });
  it('does not queue already closed portfolio records',()=>{
    expect(preparePublicationNotice({...base,status:'ENCERRADO'}).reason).toBe('already_closed');
    expect(preparePublicationNotice({...base,status_interno:'ARQUIVADO'}).reason).toBe('already_closed');
  });
  it('can include already closed records only in the special scan',()=>{
    const record={...base,status:'ENCERRADO'};
    expect(preparePublicationNotice(record).reason).toBe('already_closed');
    expect(preparePublicationNotice(record,{includeClosed:true}).reason).toBe('ok');
  });
  it('requires affirmative individual consent; attestation alone cannot override it',()=>{
    expect(preparePublicationNotice({...base,dados:{}}).reason).toBe('consent_missing');
    expect(preparePublicationNotice({...base,dados:{whatsapp_opt_in:false}}).reason).toBe('blocked');
    expect(preparePublicationNotice({...base,dados:{whatsapp_opt_in:true,nao_contatar:true}}).reason).toBe('blocked');
  });
  it('does not invent the judgment outcome from a generic boolean or transit',()=>{
    const x={...base,is_procedente:true,djen_ultimo_resumo:'Publicação de intimação',procedente_motivo:null,detalhes_execucao:null};
    expect(preparePublicationNotice(x).reason).toBe('review_verdict');
  });
  it('requires a dated recorded terminal event; a scheduled event is not final',()=>{
    expect(preparePublicationNotice({...base,datajud_ultimo_nome:'Aguardando trânsito em julgado'}).reason).toBe('no_terminal');
    expect(preparePublicationNotice({...base,datajud_ultimo_movimento:null}).reason).toBe('no_terminal');
  });
  it('rejects conflicting outcomes instead of choosing a convenient one',()=>{
    expect(preparePublicationNotice({...base,procedente_motivo:'Julgado improcedente'}).reason).toBe('review_conflict');
  });
  it('treats dismissal without merits separately from losing on the merits',()=>{
    const x=preparePublicationNotice({...base,
      datajud_ultimo_nome:'Processo extinto sem resolução do mérito',
      djen_ultimo_resumo:'Extinto sem resolução do mérito',
    });
    expect(x.notice?.verdict).toBe('sem_merito');
    expect(x.notice?.message).toContain('sem análise do mérito');
  });
  it('never repeats a previous delivered publication or a future date',()=>{
    expect(preparePublicationNotice({...base,alert_delivered_at:'2026-10-07T10:00:00Z'}).reason).toBe('already_notified');
    expect(preparePublicationNotice({...base,datajud_ultimo_movimento:'2099-01-01',djen_ultima_data:'2099-01-01'}).reason).toBe('no_terminal');
  });
  it('creates stable deduplication IDs for the same event, not random permutations',()=>{
    const a=preparePublicationNotice(base).notice!;
    const b=preparePublicationNotice({...base,cliente:'Maria Silva'}).notice!;
    const c=preparePublicationNotice({...base,datajud_ultimo_movimento:'2026-10-07T12:00:00Z'}).notice!;
    expect(a.event_hash).toBe(b.event_hash);
    expect(c.event_hash).not.toBe(a.event_hash);
  });
});
