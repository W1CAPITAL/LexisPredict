import { describe, expect, it } from 'vitest';
import { createdByOwnerIds } from './carteira-owner-ids';

describe('P0: owner identity across Supabase RLS and legacy carteira',()=>{
 const a='00000000-0000-4000-8000-000000000001';
 const p='00000000-0000-4000-8000-000000000002';
 it('matches auth and profile ids for the same validated server user',()=>{
  expect(createdByOwnerIds(a,p)).toEqual([a,p]);
 });
 it('deduplicates identical ids and rejects unexpected identifiers',()=>{
  expect(createdByOwnerIds(a,a)).toEqual([a]);
  expect(createdByOwnerIds('garbage','')).toEqual([]);
  expect(createdByOwnerIds(null,null)).toEqual([]);
 });
});
