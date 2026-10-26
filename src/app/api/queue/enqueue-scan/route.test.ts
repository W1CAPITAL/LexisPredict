import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {POST} from './route';

const tenant='d37fd4bb-1c71-4dca-b97e-292355918d39';
const req=(authorization:string,body:unknown)=>new Request('https://app.example/api/queue/enqueue-scan',{
 method:'POST',
 headers:{Authorization:authorization,'Content-Type':'application/json'},
 body:JSON.stringify(body),
});

describe('P0: worker authenticated scan trigger',()=>{
 beforeEach(()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({success:true,processed:1}),{
   status:200,headers:{'Content-Type':'application/json'}
  })));
 });
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

 it('fails closed when no worker secret exists (even with Bearer undefined)',async()=>{
  vi.stubEnv('DATAJUD_WORKER_SECRET','');
  expect((await POST(req('Bearer undefined',{empresa_id:tenant}))).status).toBe(401);
  expect((await POST(req('Bearer ',{empresa_id:tenant}))).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
 });

 it('does not accept an incorrect bearer key or invalid tenant',async()=>{
  vi.stubEnv('DATAJUD_WORKER_SECRET','private-secret');
  expect((await POST(req('Bearer other',{empresa_id:tenant}))).status).toBe(401);
  expect((await POST(req('Bearer private-secret',{empresa_id:'not-uuid'}))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
 });

 it('forwards only validated tenant and whitelisted mode to the protected worker',async()=>{
  vi.stubEnv('DATAJUD_WORKER_SECRET','private-secret');
  vi.stubEnv('NEXT_PUBLIC_APP_URL','https://app.example');
  const response=await POST(req('Bearer private-secret',{empresa_id:tenant,mode:'../../malicious'}));
  expect(response.status).toBe(200);
  const [url,options]=vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe('https://app.example/api/datajud-worker?empresa_id='+tenant+'&mode=both');
  expect((options?.headers as Record<string,string>).Authorization).toBe('Bearer private-secret');
 });
});
