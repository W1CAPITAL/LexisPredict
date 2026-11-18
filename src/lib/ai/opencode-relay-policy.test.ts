import {describe,it,expect} from 'vitest';
import {openCodeRelayRequest,RELAY_ORIGIN} from './opencode-relay-policy';
const id='d023bcb2-780d-4b3b-ae3e-d861bba4c30a';
describe('OpenCode remoto para Lexis',()=>{
 it('envia apenas para endereço seguro W1 e operações autorizadas',()=>{
  expect(RELAY_ORIGIN).toBe('https://predictbot-opencode.daviconcentrix.workers.dev');
  expect(openCodeRelayRequest({action:'devices'})).toEqual({method:'GET',path:'/v1/devices',body:null});
  expect(openCodeRelayRequest({action:'task',jobId:id})).toEqual({method:'POST',path:'/v1/task',body:{jobId:id}});
  expect(openCodeRelayRequest({action:'submit',deviceId:id,key:id,operation:'create',input:{title:'Revisão humana'}}).body?.operation).toBe('create');
  expect(openCodeRelayRequest({action:'submit',deviceId:id,key:id,operation:'prompt',input:{sessionId:'ses123',text:'Testar'}}).body?.operation).toBe('prompt');
 });
 it('nega endereços externos, outras operações, código remoto e textos excessivos',()=>{
  for(const x of [{action:'devices',url:'http://localhost:80'}, {action:'submit',deviceId:id,key:id,operation:'abort',input:{sessionId:'ses123'}},{action:'submit',deviceId:id,key:id,operation:'prompt',input:{sessionId:'ses123',text:'x'.repeat(40000)}},{action:'task',jobId:'../other'}]) expect(()=>openCodeRelayRequest(x)).toThrow();
 });
});
