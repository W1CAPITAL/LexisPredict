import {beforeEach,describe,expect,it,vi} from 'vitest';
import {getSupabaseAdmin,getUserContext} from '@/lib/server-db';
import {fetchProcessosEmpresaKpisAction} from '@/app/actions/processos-kpis-action';

vi.mock('@/lib/server-db',()=>({
 getUserContext:vi.fn(),
 getSupabaseAdmin:vi.fn(),
}));

const mockContext={auth_id:'auth-user',empresa_id:'tenant-a',caseScope:'empresa',isSupervisor:false,isSuperAdmin:false};

describe('P0 KPIs empresariais: leitura completa e filtro autenticado',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(getUserContext).mockResolvedValue(mockContext as any);
 });

 it('fails closed rather than showing partial numbers if a later page fails',async()=>{
  let offset=0;
  const firstPage=Array.from({length:1000},(_,i)=>({
   id:i+1,status:'Vencido',status_interno:'EM ANDAMENTO',dados:{}
  }));
  const query:any={
   select:()=>query,eq:()=>query,order:()=>query,in:()=>query,
   range:(start:number)=>{offset=start;return query;},
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(
    offset===0?{data:firstPage,error:null}:{data:null,error:{message:'page failure'}}
   ).then(resolve),
  };
  vi.mocked(getSupabaseAdmin).mockResolvedValue({from:()=>query} as any);
  const result=await fetchProcessosEmpresaKpisAction(true);
  expect(result.ok).toBe(false);
  expect(result.total).toBe(0);
  expect(result.error).toMatch(/todos os indicadores/i);
 });

 it('counts overdue returns across the company and ignores stale closed JSON when typed status is active',async()=>{
  let ownerFilterCalls=0;
  const query:any={
   select:()=>query,eq:()=>query,order:()=>query,range:()=>query,
   in:()=>{ownerFilterCalls++;return query;},
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({
    data:[{
     id:241195,created_by:'another-company-user',status:'Atenção',status_interno:'EM ANDAMENTO',
     proximo_retorno:'2020-01-01',ultimo_retorno:'2020-01-01',
     dados:{status:'Encerrado',situacao:'ENCERRADO',status_interno:'ENCERRADO',statusManual:'Encerrado'}
    }],error:null
   }).then(resolve),
  };
  vi.mocked(getUserContext).mockResolvedValue({...mockContext,caseScope:'mine'} as any);
  vi.mocked(getSupabaseAdmin).mockResolvedValue({from:()=>query} as any);
  const result=await fetchProcessosEmpresaKpisAction(false);
  expect(result).toMatchObject({ok:true,total:1,ativos:1,encerradosCarteira:0,vencidos:1});
  expect(ownerFilterCalls).toBe(0);
 });
});
