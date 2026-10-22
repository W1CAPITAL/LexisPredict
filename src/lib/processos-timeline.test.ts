import { describe, expect, it } from 'vitest';
import {
  buildProcessTimeline, cnjDigits, formatCnj, linkedCumprimentoCnjs,
  mergeProcessTimelineEntries
} from './processos-timeline';

const principal='4006713-51.2026.8.26.0002';
const cumprimento='4009813-88.2026.8.26.0002';

describe('/processos · Mov. cronologia completa',()=>{
  it('não limita a oito: preserva todos os movimentos DataJud e os posteriores à sentença',()=>{
    const movimentos=Array.from({length:17},(_,index)=>({
      nome:index===16?'Início do cumprimento de sentença':'Movimento nº '+index,
      dataHora:new Date(Date.UTC(2026,8,index+1,10)).toISOString(),
      complementosTabelados:[{nome:'Complemento '+index}]
    }));
    const entries=buildProcessTimeline(principal,[{cnj:principal,movimentos}]);
    expect(entries).toHaveLength(17);
    expect(entries[0].phase).toBe('cumprimento');
    expect(entries[0].detail).toBe('Complemento 16');
    expect(entries.at(-1)?.label).toBe('Movimento nº 0');
  });

  it('inclui a fase executiva de outro CNJ somente com vínculo explícito',()=>{
    const links=linkedCumprimentoCnjs({
      cnj_cumprimento:cumprimento,
      observacao:'CNPJ e processos não vinculados',
      processos_vinculados:[{tipo:'cumprimento de sentença',cnj:cumprimento}]
    },principal);
    expect(links).toEqual([cnjDigits(cumprimento)]);
    expect(linkedCumprimentoCnjs({observacao:cumprimento},principal)).toEqual([]);
    const entries=buildProcessTimeline(principal,[
      {cnj:principal,movimentos:[{nome:'Trânsito em julgado',dataHora:'2026-06-01'}]},
      {cnj:links[0],linked:true,movimentos:[{nome:'Intimação para pagamento',dataHora:'2026-10-01'}]}
    ]);
    expect(entries[0].cnj).toBe(cnjDigits(cumprimento));
    expect(entries[0].phase).toBe('cumprimento');
    expect(formatCnj(entries[0].cnj)).toBe(cumprimento);
  });

  it('separa comunicações DJEN e atendimentos; ordena por data e remove repetição entre páginas',()=>{
    const entries=buildProcessTimeline(principal,[{
      cnj:principal,
      movimentos:[{nome:'Sentença',dataHora:'2026-08-01T13:30:00Z'}],
      comunicacoes:[{
        id:123, data_disponibilizacao:'2026-09-01', tipoComunicacao:'Intimação',
        tipoDocumento:'Sentença', texto:'A decisão foi publicada.'
      }]
    }],{ultimoRetorno:'2026-10-01',observacao:'Contato realizado.'});
    expect(entries.map(x=>x.source)).toEqual(['Atendimento','DJEN','DataJud']);
    expect(entries[1].label).toContain('Sentença');
    const merged=mergeProcessTimelineEntries(entries,[entries[1],{
      ...entries[1],id:'novo-ato',date:'2026-10-05',label:'Novo ato no cumprimento',phase:'cumprimento'
    }]);
    expect(merged).toHaveLength(4);
    expect(merged[0].label).toBe('Novo ato no cumprimento');
  });
});
