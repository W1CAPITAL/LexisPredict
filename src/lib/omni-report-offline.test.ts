import {describe,it,expect} from 'vitest';
import {buildOfflineOmniReport} from './omni-report-offline';
describe('OmniReport grátis documental',()=>{
  const sources=[
    {id:'S01',name:'Ata interna',kind:'texto',text:'Registro de reunião em 08/10/2026.\nProcesso 1008980-60.2025.8.26.0577: consta relato de intimação, a conferir nos autos.\nFoi informado um prazo, mas não há protocolo anexado.'},
    {id:'P02',name:'Carteira Lexis',kind:'processo_interno',text:'Processo 1008980-60.2025.8.26.0577 com movimentação cadastrada em 2026-09-01.'},
  ];
  it('returns a full cited report for every depth with no external model calls',()=>{
    for (const detail of ['normal','profundo','maximo'] as const){
      const result=buildOfflineOmniReport('Audite este processo',sources,detail);
      expect(result.sections.length).toBeGreaterThanOrEqual(4);
      expect(result.sections.some(x=>x.body.includes('[S01]'))).toBe(true);
      expect(result.executive.metrics[0].value).toBe('2');
      expect(result.cnjs).toBe(1);
      expect(result.executive.cautions.length).toBeGreaterThan(0);
    }
  });
  it('does not claim unverified allegations as court-confirmed facts',()=>{
    const r=buildOfflineOmniReport('Investigue prazo',sources,'maximo');
    const all=r.sections.map(x=>x.body).join(' ');
    expect(all).toContain('não verificadas judicialmente');
    expect(all).toContain('consultas externas'); 
  });
  it('does not hallucinate court findings when given only an instruction',()=>{
    const r=buildOfflineOmniReport('Relatório',[], 'normal');
    expect(r.cnjs).toBe(0);
    expect(r.executive.offices).toEqual([]);
  });
});
