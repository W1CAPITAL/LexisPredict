import {describe,it,expect} from 'vitest';
import {classificarVencimento,isVencidoNoCRM,isVencidoAcionavelCRM,resumirCentralVencidos} from './vencimentos';

const hoje='2026-10-26';
const base={status:'No Prazo',status_interno:'EM ANDAMENTO',proximo_retorno:null,ultimo_retorno:null,proximo_prazo:null};
const prepared=(rows:Array<typeof base & {dados?:Record<string,unknown>}>)=>
 rows.map(p=>({...p,flag:classificarVencimento(p,hoje)}));

describe('P0 vencidos: número do CRM não é contagem de retorno atrasado',()=>{
 it('prioritizes the canonical status over stale JSON',()=>{
  expect(isVencidoNoCRM({...base,status:'No Prazo',dados:{status:'Vencido'}})).toBe(false);
  expect(isVencidoNoCRM({...base,status:null,dados:{status:'Vencido'}})).toBe(true);
  expect(isVencidoNoCRM({...base,status:'CASO CRÍTICO'})).toBe(true);
 });

 it('excludes closed marked records from operational overdue, retaining audit',()=>{
  const closed={...base,status:'Vencido',status_interno:'ENCERRADO'};
  expect(isVencidoAcionavelCRM(closed)).toBe(false);
  const counts=resumirCentralVencidos(prepared([closed]));
  expect(counts).toEqual({todos:0,retorno:0,prazo:0,revisar:1,encerradosMarcados:1});
 });

 it('counts date-overdue returns separately and never treats a historical prazo as overdue',()=>{
  const rows=prepared([
   {...base,status:'Vencido',proximo_retorno:'2026-10-20'},
   {...base,status:'No Prazo',proximo_retorno:'2026-10-20'},
   {...base,status:'No Prazo',proximo_retorno:'2026-11-20',ultimo_retorno:'2026-10-20',proximo_prazo:'2026-01-01'},
  ]);
  expect(resumirCentralVencidos(rows)).toEqual({
   todos:1,retorno:2,prazo:1,revisar:1,encerradosMarcados:0
  });
 });

 it('does not call an attended client overdue merely because an old return date survived',()=>{
  const row={...base,status:'Vencido',ultimo_retorno:'2026-10-22',proximo_retorno:'2026-10-15'};
  const flag=classificarVencimento(row,hoje);
  expect(flag.retorno).toBe(false);
  expect(flag.inconsistencia).toBe(true);
  expect(resumirCentralVencidos([{...row,flag}]).todos).toBe(1);
 });
});
