import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({queue:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/server-db',()=>({getGlobalPendingProcessesSystem:mock.queue}));
vi.mock('@/app/actions/case-actions',()=>({auditCaseCoreSystem:mock.audit}));
import {runCloudScanBatch} from './cloud-scan-batch';

const input={empresaId:'tenant-1',mode:'both' as const,scope:'full' as const,since:'2026-10-26T00:00:00.000Z'};

describe('P0: cloud scan cannot claim success on failed official reads',()=>{
 beforeEach(()=>{mock.queue.mockReset();mock.audit.mockReset();});

 it('never treats a failed database query as an empty/completed scan',async()=>{
  mock.queue.mockRejectedValue(new Error('database unavailable'));
  await expect(runCloudScanBatch(input)).rejects.toThrow('database unavailable');
  expect(mock.audit).not.toHaveBeenCalled();
 });

 it('only reports the queue complete when a query returned an actual empty array',async()=>{
  mock.queue.mockResolvedValue([]);
  const result=await runCloudScanBatch(input);
  expect(result).toMatchObject({success:true,processed:0,successCount:0,failedCount:0});
 });

 it('reports failed source lookups as a failed batch, never as success',async()=>{
  mock.queue.mockResolvedValue([{id:1,protocolo:'1234567-00.2026.8.26.0001'}]);
  mock.audit.mockResolvedValue({success:false,offline:true,sourceStatus:{datajud:{ok:false},djen:{ok:false}}});
  const result=await runCloudScanBatch(input);
  expect(result).toMatchObject({success:false,processed:1,successCount:0,failedCount:1});
 });

 it('counts a DJEN-only result as partial even when the batch can continue',async()=>{
  mock.queue.mockResolvedValue([{id:1,protocolo:'1234567-00.2026.8.26.0001'}]);
  mock.audit.mockResolvedValue({
   success:true,offline:false,sourceStatus:{datajud:{ok:false},djen:{ok:true}}
  });
  expect(await runCloudScanBatch(input)).toMatchObject({
   success:true,processed:1,successCount:1,partialCount:1,failedCount:0,
   caseResults:[{datajudOk:false,djenOk:true}]
  });
 });

 it('records genuine official success while staying inside the requested tenant',async()=>{
  mock.queue.mockResolvedValue([{id:1,protocolo:'1234567-00.2026.8.26.0001'}]);
  mock.audit.mockResolvedValue({success:true,sourceStatus:{datajud:{ok:true},djen:{ok:true}}});
  expect(await runCloudScanBatch(input)).toMatchObject({success:true,processed:1,successCount:1,failedCount:0});
  expect(mock.queue).toHaveBeenCalledWith(1,'tenant-1',expect.objectContaining({scope:'full',mode:'both'}));
  expect(mock.audit).toHaveBeenCalledWith('1234567-00.2026.8.26.0001','tenant-1','both',expect.any(Object));
 });

 it('processes a bounded batch concurrently and advances to the last selected ID',async()=>{
  mock.queue.mockResolvedValue([
   {id:1,db_id:'1',protocolo:'1234567-00.2026.8.26.0001'},
   {id:2,db_id:'2',protocolo:'1234567-00.2026.8.26.0002'},
   {id:3,db_id:'3',protocolo:'1234567-00.2026.8.26.0003'},
  ]);
  let active=0;
  let maxActive=0;
  mock.audit.mockImplementation(async()=>{
   active+=1;
   maxActive=Math.max(maxActive,active);
   await new Promise(resolve=>setTimeout(resolve,10));
   active-=1;
   return {success:true,sourceStatus:{datajud:{ok:true},djen:{ok:true}}};
  });
  const result=await runCloudScanBatch(input);
  expect(maxActive).toBe(3);
  expect(result).toMatchObject({processed:3,successCount:3,failedCount:0,lastId:'3'});
  expect(mock.queue).toHaveBeenCalledWith(3,'tenant-1',expect.objectContaining({scope:'full',mode:'both'}));
 });

});
