import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
 getUserContext:vi.fn(),
 getSupabaseAdmin:vi.fn(),
 getAtividadesRegistradasPorResponsavel:vi.fn()
}));
vi.mock('@/lib/server-db',()=>({
 getUserContext:mocks.getUserContext,
 getSupabaseAdmin:mocks.getSupabaseAdmin
}));
vi.mock('@/lib/atividades-registradas',()=>({
 getAtividadesRegistradasPorResponsavel:mocks.getAtividadesRegistradasPorResponsavel
}));
import {loadAtividadesRegistradasKpi} from './atividades-kpi-service';

describe('KPI de atividades no LexisPredict desktop',()=>{
 beforeEach(()=>{vi.resetAllMocks()});
 it('não consulta dados se a sessão não possui empresa autenticada',async()=>{
  mocks.getUserContext.mockResolvedValue({auth_id:null,empresa_id:null});
  await expect(loadAtividadesRegistradasKpi()).resolves.toEqual({ok:false,reason:'unauthenticated'});
  expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
 });
 it('conta apenas a empresa autenticada e separa responsáveis que têm registros',async()=>{
  mocks.getUserContext.mockResolvedValue({auth_id:'current-user',empresa_id:'empresa-a'});
  mocks.getAtividadesRegistradasPorResponsavel.mockResolvedValue({
   'user-b':{registros:3,processos:2,contatosMarcados:1,semReferencia:0},
   'user-a':{registros:5,processos:4,contatosMarcados:0,semReferencia:1},
   'user-c':{registros:0,processos:0,contatosMarcados:0,semReferencia:0}
  });
  const query={select:vi.fn(),eq:vi.fn(),in:vi.fn()};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
  query.in.mockResolvedValue({data:[
   {auth_user_id:'user-a',nome:'Ana'},
   {auth_user_id:'user-b',nome:'Bruna'}
  ],error:null});
  mocks.getSupabaseAdmin.mockResolvedValue({from:vi.fn().mockReturnValue(query)});
  const value=await loadAtividadesRegistradasKpi();
  expect(value.ok).toBe(true);
  if(!value.ok)return;
  expect(value.count).toBe(8);
  expect(value.responsaveis.map(r=>r.nome)).toEqual(['Ana','Bruna']);
  expect(mocks.getAtividadesRegistradasPorResponsavel).toHaveBeenCalledWith('empresa-a');
  expect(query.eq).toHaveBeenCalledWith('empresa_id','empresa-a');
  expect(value.responsaveis.every(r=>r.registros>0)).toBe(true);
 });
 it('não apresenta zero se a contagem ou perfil falhar',async()=>{
  mocks.getUserContext.mockResolvedValue({auth_id:'current-user',empresa_id:'empresa-a'});
  mocks.getAtividadesRegistradasPorResponsavel.mockRejectedValue(Error('PostgREST timeout'));
  await expect(loadAtividadesRegistradasKpi()).resolves.toEqual({ok:false,reason:'unavailable'});
 });
});
