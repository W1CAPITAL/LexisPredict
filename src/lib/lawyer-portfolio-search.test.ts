import {describe,it,expect} from 'vitest';
import {LAWYER_SEARCH_COLUMNS,mergeLawyerSearchResults} from './lawyer-portfolio-search';

describe('Busca de advogado em carteira legada',()=>{
  it('inclui coluna estruturada e ambos os caminhos antigos de JSON',()=>{
    expect(LAWYER_SEARCH_COLUMNS).toEqual(['advogado','dados->>advogado','dados->>ADVOGADO']);
  });
  it('consolida registros vindos do JSON sem duplicar processos',()=>{
    const merged=mergeLawyerSearchResults([
      [{id:'1',advogado:'MARIA',updated_at:'2026-11-01'}],
      [{id:'1',advogado_json:'MARIA',updated_at:'2026-11-01'},{id:'2',advogado_json:'MARIA',updated_at:'2026-11-03'}],
      [{id:'3',advogado_alt:'MARIA',updated_at:'2026-11-02'}],
    ]);
    expect(merged.rows.map(x=>String(x.id))).toEqual(['2','3','1']);
    expect(merged.partial).toBe(false);
  });
  it('indica resultados parciais sem tratar os 60 primeiros como total',()=>{
    const groups=[Array.from({length:61},(_,i)=>({id:i+1,updated_at:'2026-11-01'})),[],[]];
    const merged=mergeLawyerSearchResults(groups);
    expect(merged.rows).toHaveLength(60);
    expect(merged.partial).toBe(true);
  });
});
