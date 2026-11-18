import {describe,it,expect,vi} from 'vitest';
import {createAuthorizedDatabaseClient} from './authorized-database-client';

describe('Banco da carteira no desktop',()=>{
 it('usa o serviço administrativo somente quando há segredo no servidor',async()=>{
  const makeAdmin=vi.fn(async()=>({kind:'admin'}));
  const makeRequest=vi.fn();
  const db=await createAuthorizedDatabaseClient({adminKey:'server-secret',makeAdmin,makeRequest});
  expect(db).toEqual({kind:'admin'});
  expect(makeRequest).not.toHaveBeenCalled();
 });
 it('sem segredo, usa a sessão autenticada e nunca a chave pública como admin',async()=>{
  const client={auth:{getUser:vi.fn(async()=>({data:{user:{id:'user-1'}},error:null}))}};
  const makeAdmin=vi.fn();
  const db=await createAuthorizedDatabaseClient({adminKey:'',makeAdmin,makeRequest:async()=>client});
  expect(db).toBe(client);
  expect(client.auth.getUser).toHaveBeenCalledOnce();
  expect(makeAdmin).not.toHaveBeenCalled();
 });
 it('sem login válido recusa a consulta e não retorna dados de outra empresa',async()=>{
  for(const user of [null,undefined]){
   const client={auth:{getUser:vi.fn(async()=>({data:{user},error:null}))}};
   await expect(createAuthorizedDatabaseClient({adminKey:'',makeAdmin:vi.fn(),makeRequest:async()=>client})).rejects.toThrow(/sessão/i);
  }
  await expect(createAuthorizedDatabaseClient({adminKey:'',makeAdmin:vi.fn(),makeRequest:async()=>null})).rejects.toThrow(/sessão/i);
 });
});
