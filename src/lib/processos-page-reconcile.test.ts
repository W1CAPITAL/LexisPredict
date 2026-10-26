import {describe,expect,it} from 'vitest';
import {reconcileCompanyPage} from './processos-page-reconcile';

type Row={id:number;protocolo:string;cliente:string;created_by:string};
const deleted:Row={id:1,protocolo:'CNJ-DELETED',cliente:'Excluído',created_by:'actor-old'};
const original:Row={id:2,protocolo:'CNJ-KEEP',cliente:'Versão antiga',created_by:'actor-old'};
const latest:Row={...original,cliente:'Atualizado no Supabase',created_by:'actor-new'};
const extra:Row={id:3,protocolo:'CNJ-EXTRA',cliente:'Outra página',created_by:'actor-third'};

describe('P0 /processos: reconcile authoritative company pages',()=>{
 it('never resurrects deleted cases after forced refresh',()=>{
  const next=reconcileCompanyPage([latest],[deleted,original,extra],[deleted,original],true);
  expect(next).toEqual([latest]);
  expect(next.map(x=>x.protocolo)).not.toContain('CNJ-DELETED');
 });

 it('honors reassignment and updated fields from server rather than stale state',()=>{
  const next=reconcileCompanyPage([latest],[original],[original],true);
  expect(next).toEqual([{...original,cliente:'Atualizado no Supabase',created_by:'actor-new'}]);
 });

 it('preserves already paginated entries only on normal nonforced reads',()=>{
  const next=reconcileCompanyPage([latest],[original,extra],[deleted,original],false);
  expect(next).toEqual([latest,extra,deleted]);
 });

 it('deduplicates incoming records by persistent row id',()=>{
  const next=reconcileCompanyPage([latest,latest],[original,latest],[],false);
  expect(next).toEqual([latest]);
 });

 it('handles verified server empty snapshots without stale fallback',()=>{
  expect(reconcileCompanyPage([], [deleted,original], [deleted], true)).toEqual([]);
 });
});
