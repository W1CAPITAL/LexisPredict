import {describe,it,expect} from 'vitest';
import {summarizeActionableDueCases,loadAllDuePages} from './today-due-consistency';

const day=new Date('2026-11-06T15:00:00.000Z');

describe('Contagem coerente entre dashboard e fila É hoje',()=>{
 it('não anuncia cliente como pendente quando já foi atendido e não houve novidade',()=>{
  const cases=[
   {id:1,cliente:'Cliente atendido',ultimoRetorno:'2026-11-06',status:'É Hoje'},
   {id:2,cliente:'Cliente pendente',ultimoRetorno:'2026-11-05',status:'É Hoje'},
   {id:3,cliente:'Cliente encerrado',status:'ENCERRADO'},
   {id:4,cliente:'Cliente atualizado',ultimoRetorno:'2026-11-06',tem_novo_andamento:true},
  ];
  const summary=summarizeActionableDueCases(cases,day);
  expect(summary.clientCount).toBe(2);
  expect(summary.pendingCases.map(x=>x.id)).toEqual([2,4]);
  expect(summary.processCount).toBe(2);
 });
 it('não duplica clientes que possuem vários processos',()=>{
  const result=summarizeActionableDueCases([
   {id:1,cliente:'MARIA SILVA'}, {id:2,cliente:' maria silva '},
   {id:3,cliente:'CARLOS'}
  ],day);
  expect(result.clientCount).toBe(2);
  expect(result.processCount).toBe(3);
 });
 it('não contabiliza processo sem cliente identificado como um cliente fictício',()=>{
  const result=summarizeActionableDueCases([{id:123,cliente:''}],day);
  expect(result.clientCount).toBe(0);
  expect(result.processCount).toBe(1);
 });
});

describe('Paginação completa e fail-closed de retornos',()=>{
 it('busca todas as páginas em sequência sem confiar no primeiro lote',async()=>{
  const called:number[]=[];
  const result=await loadAllDuePages(async offset=>{
   called.push(offset);
   return offset===0?{cases:[{id:1},{id:2}],hasMore:true}:{cases:[{id:3}],hasMore:false};
  });
  expect(called).toEqual([0,2]);
  expect(result.map(x=>x.id)).toEqual([1,2,3]);
 });
 it('não transforma paginação inconsistente em falso total',async()=>{
  await expect(loadAllDuePages(async offset=>offset===0
    ?{cases:[{id:1}],hasMore:true}
    :{cases:[],hasMore:true})).rejects.toThrow(/incompleta/i);
 });
 it('não apresenta número parcial se exceder o limite de segurança',async()=>{
  await expect(loadAllDuePages(async()=>({cases:[1,2,3],hasMore:true}),{maxCases:2}))
   .rejects.toThrow(/incompleta/i);
 });
});
