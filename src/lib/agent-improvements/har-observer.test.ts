import {describe,it,expect} from 'vitest';
import {inspectAuthorizedHar,sanitizedPath,MAX_HAR_BYTES} from './har-observer';

describe('auditoria de APIs autorizadas e protegidas',()=>{
 const make=(url:string,status=200,headers:unknown[]=[]):unknown=>({
  request:{url,method:'GET',headers,postData:{text:'CPF 123.456.789-00 secret'}},
  response:{status,content:{text:'password secret'},headers:[]},time:3000
 });
 it('anonymizes URL paths, strips query parameters and never emits secrets or body',()=>{
  const token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const data={log:{entries:[make('https://lexispredict.vercel.app/api/processos/123456789001?token='+token,401,
    [{name:'Authorization',value:'Bearer '+token},{name:'Cookie',value:'auth=abc'}])]}};
  const output=inspectAuthorizedHar(data);
  const serialized=JSON.stringify(output);
  expect(serialized).toContain('/api/processos/:id');
  expect(output.endpoints[0].authFailures).toBe(1);
  expect(output.redactedCredentials).toBeGreaterThan(0);
  for(const secret of [token,'Bearer','auth=abc','123456789001','123.456.789-00','password secret','CPF']){
   expect(serialized).not.toContain(secret);
  }
  expect(output.previewOnly).toBe(true);
 });
 it('refuses malformed HAR and large capture to bound computation',()=>{
  expect(()=>inspectAuthorizedHar({log:{notEntries:[]}})).toThrow(/HAR inválido/);
  expect(()=>inspectAuthorizedHar({log:{entries:Array(2001).fill(null)}})).toThrow(/2.000/);
  expect(MAX_HAR_BYTES).toBe(3145728);
 });
 it('groups sanitized routes with 5xx, rate limits, retries and durations',()=>{
  const data={log:{entries:[
   make('https://lexispredict.vercel.app/api/report/98765',503),
   make('https://lexispredict.vercel.app/api/report/76543',429),
   make('https://lexispredict.vercel.app/api/report/24680',200),
  ]}};
  const out=inspectAuthorizedHar(data);
  expect(out.total).toBe(3);
  expect(out.endpoints).toHaveLength(1);
  expect(out.endpoints[0]).toMatchObject({calls:3,errors:1,limited:1,latencyMs:3000,needsReview:true});
  expect(out.suggestions.join(' ')).toMatch(/backoff|N\+1/);
 });
 it('never exposes client-name and identifier segments',()=>{
  expect(sanitizedPath('/api/processos/123.456.789-09/JOAO-SILVA-SECRET')).toBe('/api/processos/:id/:id');
 });
});
