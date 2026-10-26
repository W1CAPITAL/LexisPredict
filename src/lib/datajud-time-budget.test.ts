import {describe,expect,it} from 'vitest';
import {DATAJUD_CLOUD_TIMEOUT_MS,resolveDataJudTimeoutMs} from './datajud-time-budget';

describe('P0 DataJud official cloud time budget',()=>{
 it('waits past the observed 26 second real API response rather than timing out after 11s',()=>{
  expect(DATAJUD_CLOUD_TIMEOUT_MS).toBeGreaterThan(26_053);
  expect(resolveDataJudTimeoutMs({cloudBudget:true,fast:true})).toBe(DATAJUD_CLOUD_TIMEOUT_MS);
 });
 it('respects browser worker 55s deadline with room for persistence and DJEN',()=>{
  expect(resolveDataJudTimeoutMs({cloudBudget:true})).toBeLessThan(40_000);
  expect(resolveDataJudTimeoutMs({cloudBudget:true})).toBeLessThan(55_000);
 });
 it('does not change interactive fast and deep audit budgets',()=>{
  expect(resolveDataJudTimeoutMs({fast:true})).toBe(32_000);
  expect(resolveDataJudTimeoutMs({fast:false})).toBe(42_000);
 });
});