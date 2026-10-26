import {afterEach,describe,expect,it,vi} from 'vitest';
import {invalidateCarteiraCache,peekCarteiraCache,writeCarteiraCache} from './session-carteira-cache';

function storageMock(){
 const entries=new Map<string,string>();
 return {
  getItem:vi.fn((key:string)=>entries.get(key)??null),
  setItem:vi.fn((key:string,value:string)=>{entries.set(key,value);}),
  removeItem:vi.fn((key:string)=>{entries.delete(key);}),
  key:vi.fn((n:number)=>Array.from(entries.keys())[n]??null),
  get length(){return entries.size;},
 };
}

afterEach(()=>{vi.unstubAllGlobals(); invalidateCarteiraCache({broadcast:false});});

describe('P0 cross-tab cache signal',()=>{
 it('broadcasts exactly once on local mutation and does not echo received signals',()=>{
  const local=storageMock();
  const session=storageMock();
  vi.stubGlobal('window',{});
  vi.stubGlobal('localStorage',local);
  vi.stubGlobal('sessionStorage',session);
  writeCarteiraCache([{id:1}],'company-a','empresa','operator-a','processos-empresa');
  expect(peekCarteiraCache('company-a','empresa','operator-a','processos-empresa')).not.toBeNull();

  invalidateCarteiraCache({broadcast:false});
  expect(local.setItem).not.toHaveBeenCalledWith('lexis_carteira_invalidation_v1',expect.anything());
  expect(peekCarteiraCache('company-a','empresa','operator-a','processos-empresa')).toBeNull();

  invalidateCarteiraCache();
  expect(local.setItem).toHaveBeenCalledTimes(1);
  expect(local.setItem).toHaveBeenCalledWith('lexis_carteira_invalidation_v1',expect.any(String));
 });

 it('also invalidates all local scopes without broadcasting',()=>{
  const local=storageMock();
  const session=storageMock();
  vi.stubGlobal('window',{});
  vi.stubGlobal('localStorage',local);
  vi.stubGlobal('sessionStorage',session);
  writeCarteiraCache([{id:10}],'company-a','empresa','operator-a','processos-empresa');
  writeCarteiraCache([{id:11}],'company-a','mine','operator-a','tarefas');
  invalidateCarteiraCache({broadcast:false});
  expect(peekCarteiraCache('company-a','empresa','operator-a','processos-empresa')).toBeNull();
  expect(peekCarteiraCache('company-a','mine','operator-a','tarefas')).toBeNull();
  expect(local.setItem).not.toHaveBeenCalled();
 });
});
