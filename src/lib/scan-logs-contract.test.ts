import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
describe('P0: status snapshots must never spoof live cloud scanner events',()=>{
 it('status API does not turn saved process flags into zero-millisecond scan logs',()=>{
  const source=readFileSync(resolve(process.cwd(),'src/lib/server-db.ts'),'utf8');
  const fn=source.split('export async function getScanStatusMetrics(')[1]
    .split('export async function updateCaseDataJudSystem(')[0];
  expect(fn).toContain('recentLogs: []');
  expect(fn).not.toContain('latency: 0');
  expect(fn).not.toContain('message: r.datajud_encerrado_tribunal');
 });
 it('client only uses real current worker caseResults, not stale telemetry as logs',()=>{
  const source=readFileSync(resolve(process.cwd(),'src/store/use-datajud-scan-store.ts'),'utf8');
  expect(source).toContain('worker.caseResults');
  expect(source).not.toContain('metrics.recentLogs.forEach');
 });
});
