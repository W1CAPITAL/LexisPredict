import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  lookup:vi.fn(),
  createClient:vi.fn(),
}));

vi.mock('@supabase/supabase-js',()=>({createClient:mocks.createClient}));
vi.mock('@/lib/wa-auto-client',()=>({
  getWaAutoConfig:()=>({baseUrl:'https://bridge.example.test',
    integrationToken:process.env.WA_INTEGRATION_TOKEN||''}),
}));
vi.mock('@/lib/wa-worker-auth',()=>({verifyWaWorkerIdentity:vi.fn(()=>null)}));

import {GET} from './route';

const shared='unit-test-secret-credential-with-strong-entropy';
const userId='11111111-1111-4111-8111-111111111111';
const empresaId='22222222-2222-4222-8222-222222222222';
const headers=(token=shared,actor=userId,second=shared)=>({
  authorization:'Bearer '+token,
  'x-lexis-user-id':actor,
  'x-wa-integration-token':second,
});

function makeDb() {
  const eq=vi.fn(()=>({maybeSingle:mocks.lookup}));
  const select=vi.fn(()=>({eq}));
  const from=vi.fn(()=>({select}));
  return {auth:{getUser:mocks.getUser},from};
}

describe('WA.Auto LexisPredict integration authentication',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','test-publishable');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','server-test-role');
    vi.stubEnv('WA_INTEGRATION_TOKEN',shared);
    mocks.createClient.mockImplementation(()=>makeDb());
    mocks.lookup.mockResolvedValue({data:{auth_user_id:userId,empresa_id:empresaId,cargo:'Superadmin'},error:null});
    mocks.getUser.mockResolvedValue({data:{user:null},error:{message:'invalid session'}});
  });
  afterEach(()=>vi.unstubAllEnvs());

  it('accepts server credential and live authorized manager identity',async()=>{
    const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers()}));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ok:true,userId,empresaId,role:'Superadmin',canManage:true});
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.lookup).toHaveBeenCalledOnce();
  });
  it('rejects missing actor or forged actor before touching the database',async()=>{
    for (const actor of ['', 'fake-user']) {
      const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers(shared,actor)}));
      expect(res.status).toBe(401);
    }
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('rejects mismatched second credential even if bearer matched',async()=>{
    const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers(shared,userId,'different')}));
    expect(res.status).toBe(401);
  });
  it('never grants an operator the automated sender identity',async()=>{
    mocks.lookup.mockResolvedValueOnce({data:{auth_user_id:userId,empresa_id:empresaId,cargo:'Operador'},error:null});
    const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers()}));
    expect(res.status).toBe(403);
  });
  it('does not accept an arbitrary bearer token as a shared credential',async()=>{
    const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers('not-the-shared-token')}));
    expect(res.status).toBe(401);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('fails closed when the service role is unavailable',async()=>{
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
    const res=await GET(new Request('https://test.invalid/api/integration/wa-auto/auth',{headers:headers()}));
    expect(res.status).toBe(503);
  });
});
