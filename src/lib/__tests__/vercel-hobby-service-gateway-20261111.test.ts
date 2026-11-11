import {afterEach,describe,expect,it,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {GET,POST} from '@/app/api/service-gateway/route';
afterEach(()=>vi.unstubAllGlobals());
const read=(p:string)=>readFileSync(p,'utf8');

describe('Vercel Hobby: BACEN e formulário na mesma função Next.js',()=>{
 it('preserva os URLs públicos e elimina duas funções avulsas da raiz',()=>{
  const config=read('next.config.ts'),vercel=JSON.parse(read('vercel.json'));
  expect(config).toContain('source: "/api/bacen-sgs"');
  expect(config).toContain('destination: "/api/service-gateway?service=bacen"');
  expect(config).toContain('source: "/api/inbound-lead"');
  expect(config).toContain('destination: "/api/service-gateway?service=inbound"');
  expect(existsSync('api/bacen-sgs.ts')).toBe(false);
  expect(existsSync('api/inbound-lead.ts')).toBe(false);
  expect(vercel.functions).toBeUndefined();
 });
 it('mantém o retorno BACEN mensal e cache público',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>[
   {data:'01/05/2026',valor:'2,43'}, {data:'02/05/2026',valor:'2,45'},
  ]});
  vi.stubGlobal('fetch',fetcher);
  const res=await GET(new Request('https://lexis.example/api/service-gateway?service=bacen&produto=veiculos&data=2026-05'));
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toContain('max-age=3600');
  expect(await res.json()).toMatchObject({ok:true,produto:'veiculos',serie:25471,taxaMediaMensal:2.45});
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toContain('bcdata.sgs.25471');
 });
 it('não aceita lead sem consentimento e nunca coloca dados do formulário em cache',async()=>{
  const res=await POST(new Request('https://lexis.example/api/service-gateway?service=inbound',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:'Maria Santos',phone:'11999999999',consent:false})
  }));
  expect(res.status).toBe(400);
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect((await res.json()).error).toContain('Consentimento');
 });
 it('rejeita modo e método não suportados, sem resposta falsa',async()=>{
  const get=await GET(new Request('https://lexis.example/api/service-gateway?service=inbound'));
  expect(get.status).toBe(404);
  const post=await POST(new Request('https://lexis.example/api/service-gateway?service=bacen',{
   method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
  }));
  expect(post.status).toBe(404);
 });
});
