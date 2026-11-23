import { describe,expect,it,vi } from 'vitest';
import {readDesktopHistorico,readDesktopRelatorio,readDesktopSupervisao} from './desktop-analytics-snapshot';

const tenant='d37fd4bb-1c71-4dca-b97e-292355918d39';
const rpc=(data:unknown,error:{message?:string;code?:string}|null=null)=>
 vi.fn(async (_name:string,_args:Record<string,unknown>)=>({data,error}));

describe('KPIs do LexisPredict desktop sem chave administrativa',()=>{
 it('usa RPC que deriva empresa do JWT, sem aceitar empresa do cliente',async()=>{
  const mock=rpc({empresa_id:tenant,historico:{dias:[],processos:0,eventos:0}});
  const data=await readDesktopHistorico({rpc:mock},tenant,'esta_semana');
  expect(data.eventos).toBe(0);
  expect(mock).toHaveBeenCalledWith('lexis_desktop_historico_snapshot',{p_periodo:'esta_semana'});
 });
 it('impede usar dados da empresa diferente mesmo que a resposta fosse adulterada',async()=>{
  const mock=rpc({empresa_id:'other',historico:{dias:[],eventos:4}});
  await expect(readDesktopHistorico({rpc:mock},tenant,'mes')).rejects.toThrow(/organiza/i);
 });
 it('retorna erro explícito quando banco rejeita o acesso, nunca KPIs zerados',async()=>{
  const mock=rpc(null,{message:'permission denied'});
  await expect(readDesktopHistorico({rpc:mock},tenant,'mes')).rejects.toThrow(/permission denied/i);
 });
 it('relatório restrito recebe owner e evita RPCs diretas bloqueadas',async()=>{
  const mock=rpc({empresa_id:tenant,portfolio:{total:2734},historico:{dias:[]},merito:{},retorno:{}});
  const data=await readDesktopRelatorio({rpc:mock},tenant,'mes',null);
  expect((data.portfolio as Record<string,unknown>).total).toBe(2734);
  expect(mock).toHaveBeenCalledWith('lexis_desktop_relatorio_snapshot',{p_periodo:'mes',p_owner:null});
 });
 it('supervisão recusa snapshot de tenant errado e dados indisponíveis',async()=>{
  const wrong=rpc({empresa_id:'other',carteira:{total:2734},atividade:{},status:{}});
  await expect(readDesktopSupervisao({rpc:wrong},tenant,'esta_semana')).rejects.toThrow(/organiza/i);
  const missing=rpc({empresa_id:tenant,carteira:null,atividade:{},status:{}});
  await expect(readDesktopSupervisao({rpc:missing},tenant,'esta_semana')).rejects.toThrow(/incompleto/i);
 });
 it('supervisão autorizada recupera carteira e produtividade em uma RPC',async()=>{
  const mock=rpc({empresa_id:tenant,carteira:{total:2734},atividade:{timeline:[]},status:{}});
  const data=await readDesktopSupervisao({rpc:mock},tenant,'esta_semana');
  expect((data.carteira as Record<string,unknown>).total).toBe(2734);
  expect(mock).toHaveBeenCalledWith('lexis_desktop_supervisao_snapshot',{p_periodo:'esta_semana'});
 });
});
