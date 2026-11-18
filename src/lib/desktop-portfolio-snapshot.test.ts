import {describe,it,expect,vi} from 'vitest';
import {readAuthorizedDesktopSnapshot} from './desktop-portfolio-snapshot';

const tenant='22222222-2222-4222-8222-222222222222';
const owner='11111111-1111-4111-8111-111111111111';
const makeDb=(data:unknown,error:{code?:string;message?:string}|null=null)=>({rpc:vi.fn(async()=>({data,error}))});

describe('Resumo da carteira sob a sessão do Supabase',()=>{
 it('retorna indicadores exatos do mesmo tenant e mantém mérito e retorno',async()=>{
  const payload={empresa_id:tenant,portfolio:{total:24,ativos:12,encerrados:12,vencidos:3},
   merito:{procedentes:4},retorno:{semRetornoLongo:8}};
  const db=makeDb(payload);
  const data=await readAuthorizedDesktopSnapshot(db,tenant,owner);
  expect(data.portfolio.total).toBe(24);
  expect(data.merito?.procedentes).toBe(4);
  expect(data.retorno?.semRetornoLongo).toBe(8);
  expect(db.rpc).toHaveBeenCalledWith('lexis_desktop_portfolio_snapshot',{p_owner:owner});
 });
 it('nunca retorna números de outra organização nem zeros fictícios',async()=>{
  await expect(readAuthorizedDesktopSnapshot(makeDb({empresa_id:'outro',portfolio:{total:900}}),tenant,null)).rejects.toThrow(/organização/i);
  await expect(readAuthorizedDesktopSnapshot(makeDb({empresa_id:tenant,portfolio:null}),tenant,null)).rejects.toThrow(/indisponível/i);
  await expect(readAuthorizedDesktopSnapshot(makeDb(null,{code:'42501'}),tenant,null)).rejects.toThrow(/indisponível/i);
 });
});
