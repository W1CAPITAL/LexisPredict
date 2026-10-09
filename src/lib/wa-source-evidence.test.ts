import {describe,expect,it} from 'vitest';
import {prepareDailyReturn,type ReturnCase} from './wa-daily-return-policy';
import {clientGreeting,buildClientMovementMessage} from './wa-client-notice';
import {latestDjenNoticeEvidence} from './wa-source-evidence';

const cnj='1000074-19.2024.8.26.0512';
const evidence={origin:'official-djen',cnj:cnj.replace(/\D/g,''),eventAt:'2026-08-20',
  text:'Providencie o recolhimento das custas em 15 dias, sob pena de extinção.',checkedAt:new Date().toISOString()};
const row:ReturnCase={id:1,empresa_id:'test-company',cliente:'ANTÔNIO SOARES',telefone:'11999994321',
  protocolo_ref:cnj,status_interno:'EM ANDAMENTO',ultimo_retorno:'2026-08-17',
  djen_ultima_data:'2026-08-20',djen_ultimo_resumo:'Extinção / cancelamento da distribuição',
  dados:{whatsapp_opt_in:true,wa_djen_evidence:evidence}};

describe('customer notices use official content, never keyword classifications',()=>{
  it('reports the actual conditional notice rather than a false extinction label',()=>{
    const result=prepareDailyReturn(row,{mode:'single'});
    expect(result.ready?.message).toContain('isso não significa que o processo já foi encerrado');
    expect(result.ready?.message).toContain('recolhimento de custas');
    expect(result.ready?.message).not.toContain('Extinção / cancelamento da distribuição');
    expect(result.ready?.message).toContain('Antônio');
    expect(result.ready?.message).not.toMatch(/Conforme solicitado\/previsto|confirmação independente|último retorno de/i);
  });
  it.each([
    {whatsapp_opt_in:true},
    {whatsapp_opt_in:true,wa_djen_evidence:{...evidence,cnj:'99999999999999999999'}},
    {whatsapp_opt_in:true,wa_djen_evidence:{...evidence,eventAt:'2026-08-19'}},
    {whatsapp_opt_in:true,wa_djen_evidence:{...evidence,checkedAt:'2026-01-01T00:00:00Z'}},
    {whatsapp_opt_in:true,wa_djen_evidence:{...evidence,text:'Julgo extinto o processo, sem resolução do mérito.'}},
  ])('withholds an unverifiable or terminal publication from an open case',dados=>{
    expect(prepareDailyReturn({...row,dados},{mode:'single'}).reason).toBe('needs_source_review');
  });
  it('never sends a bare numeric movement code, or an old DataJud lookup',()=>{
    const movement={...row,djen_ultima_data:null,datajud_ultimo_movimento:'2026-09-28T21:23:41-03:00',datajud_ultimo_nome:'Cód. 15417',datajud_consultado_em:new Date().toISOString()};
    expect(prepareDailyReturn(movement,{mode:'single'}).reason).toBe('needs_source_review');
    expect(prepareDailyReturn({...movement,datajud_ultimo_nome:'Definitivo'},{mode:'single'}).reason).toBe('needs_source_review');
    expect(prepareDailyReturn({...movement,datajud_ultimo_nome:'Conclusos para despacho',datajud_consultado_em:'2026-08-01T00:00:00Z'},{mode:'single'}).reason).toBe('needs_source_review');
  });
  it('uses Brazilian time for greetings and does not invent an appointment',()=>{
    expect(clientGreeting('ANTÔNIO SOARES',new Date('2026-10-09T18:00:00Z'))).toContain('Boa tarde, Antônio!');
    expect(clientGreeting('Maria',new Date('2026-10-09T12:00:00Z'))).toContain('Bom dia, Maria!');
    const message=buildClientMovementMessage({firstName:'Antônio',cnj,date:'28/09/2026',detail:'Conclusos para despacho'});
    expect(message).toContain('encaminhado ao juiz para análise e despacho');
    expect(message).not.toMatch(/encerrado|extinto|procedente|diariamente|14\/10|mesmo que não haja/i);
  });
  it('selects the latest dated publication only for the same CNJ',()=>{
    const base={id:1,data_disponibilizacao:'2026-08-20',siglaTribunal:'TJSP',tipoComunicacao:'Intimação',nomeOrgao:null,texto:'Teor oficial',numero_processo:cnj,meio:'D',link:null,tipoDocumento:'Despacho',nomeClasse:null};
    expect(latestDjenNoticeEvidence(cnj,[{...base,numero_processo:'wrong',data_disponibilizacao:'2026-09-30'},base])?.eventAt).toBe('2026-08-20');
  });
  it('holds an API event superseded by a newer court consultation supplied by the responsible user',()=>{
    expect(prepareDailyReturn({...row,dados:{...row.dados,tribunal_conferencia:{cnj,ultimo_evento_em:'2026-09-28T21:23:41-03:00'}}},{mode:'single'}).reason).toBe('needs_source_review');
  });
  it('explains a verified proof notice without copying headers, statutes or promising a hearing',()=>{
    const detail='Tribunal de Justiça. ATO ORDINATÓRIO. Nos termos do art. 203, § 4º do CPC, intimo AS PARTES para, no prazo comum de 05 dias, informarem se pretendem produzir outras provas, notadamente prova oral em audiência de instrução, especificando-as em caso positivo.';
    const message=buildClientMovementMessage({firstName:'JOSE',cnj,date:'02/09/2026',detail,source:'DJEN'});
    expect(message).toContain('intimação para que as partes informem se pretendem apresentar outras provas');
    expect(message).not.toMatch(/art\. 203|Tribunal de Justiça|§|audiência marcada|aguardando julgamento/i);
  });
  it('does not turn a request to one party into a request to both parties',()=>{
    const detail='Intimo a parte autora para informar se pretende produzir outras provas.';
    const message=buildClientMovementMessage({firstName:'Maria',cnj,date:'02/09/2026',detail,source:'DJEN'});
    expect(message).not.toContain('as partes informem');
  });
});
