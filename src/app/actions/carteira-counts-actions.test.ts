import {beforeEach,describe,expect,it,vi} from 'vitest';

const state=vi.hoisted(()=>({
 ctx:{empresa_id:'tenant-1',auth_id:'actor-1',isSupervisor:false,isSuperAdmin:false},
 result:{data:[{total:2648,ativos:451,encerrados:2197}],error:null} as any,
 rpc:vi.fn(),
}));
vi.mock('@/lib/server-db',()=>({
 getUserContext:async()=>state.ctx,
 getSupabaseAdmin:async()=>({rpc:state.rpc}),
}));
import {fetchCarteiraCountsAction} from './carteira-counts-actions';

describe('P0: secondary portfolio KPIs share the official RPC',()=>{
 beforeEach(()=>{
  state.ctx={empresa_id:'tenant-1',auth_id:'actor-1',isSupervisor:false,isSuperAdmin:false};
  state.result={data:[{total:2648,ativos:451,encerrados:2197}],error:null};
  state.rpc.mockReset().mockImplementation(async()=>state.result);
 });

 it('uses authenticated personal owner instead of an unsafely aggregated atendido_por',async()=>{
  const result=await fetchCarteiraCountsAction();
  expect(result).toMatchObject({ok:true,total:2648,ativos:451,encerrados:2197,isEmpresaWide:false});
  expect(state.rpc).toHaveBeenCalledWith('lexis_portfolio_snapshot',{
   p_empresa:'tenant-1',p_owner:'actor-1',
  });
 });

 it('supervisor obtains only company snapshot with nil owner',async()=>{
  state.ctx.isSupervisor=true;
  expect((await fetchCarteiraCountsAction()).isEmpresaWide).toBe(true);
  expect(state.rpc).toHaveBeenCalledWith('lexis_portfolio_snapshot',{
   p_empresa:'tenant-1',p_owner:null,
  });
 });

 it('does not silently convert a database failure into zero active processes',async()=>{
  state.result={data:null,error:{message:'RPC unavailable'}};
  expect(await fetchCarteiraCountsAction()).toMatchObject({ok:false,error:'Indicadores indisponíveis.'});
 });

 it('rejects inconsistent or absent totals rather than publishing a wrong KPI',async()=>{
  state.result={data:[{total:2648,ativos:451,encerrados:2196}],error:null};
  expect((await fetchCarteiraCountsAction()).ok).toBe(false);
  state.result={data:[],error:null};
  expect((await fetchCarteiraCountsAction()).ok).toBe(false);
 });

 it('rejects unauthenticated context without calling privileged database',async()=>{
  state.ctx.auth_id='';
  expect((await fetchCarteiraCountsAction()).ok).toBe(false);
  expect(state.rpc).not.toHaveBeenCalled();
 });
});
