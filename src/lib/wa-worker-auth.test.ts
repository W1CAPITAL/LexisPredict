import {describe,it,expect} from 'vitest';
import {signWaWorkerIdentity,verifyWaWorkerIdentity} from './wa-worker-auth';
const key='test-only-credential-not-for-production';
const owner='11111111-1111-1111-1111-111111111111',company='22222222-2222-2222-2222-222222222222';
describe('WA background callback identity',()=>{
 it('verifies a company-bound short-lived identity',()=>{
  const token=signWaWorkerIdentity(owner,company,key,100000);
  expect(verifyWaWorkerIdentity(token,key,101000)?.empresaId).toBe(company);
 });
 it('rejects tampering, expired tokens and another key',()=>{
  const token=signWaWorkerIdentity(owner,company,key,100000);
  expect(verifyWaWorkerIdentity(token+'x',key,101000)).toBeNull();
  expect(verifyWaWorkerIdentity(token,key,190000)).toBeNull();
  expect(verifyWaWorkerIdentity(token,'another-test-key',101000)).toBeNull();
 });
});
