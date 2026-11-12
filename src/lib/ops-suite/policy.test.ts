import {describe,expect,it} from 'vitest';
import {canUseOpsCapability,normalizeOpsPhone,normalizeOpsCnj,opsCnjVariants,validateOpsAgentDraft,validateIntakeAnswers,eligibleForRecording} from './policy';

describe('Lexis integrated operations policy',()=>{
 it('allows operational workflow but refuses administrative permissions for operators',()=>{
  expect(canUseOpsCapability('Operador','workflow.write')).toBe(true);
  expect(canUseOpsCapability('Operador','permissions.manage')).toBe(false);
  expect(canUseOpsCapability('Visualizador','workflow.write')).toBe(false);
  expect(canUseOpsCapability('Administrador','permissions.manage')).toBe(true);
 });
 it('requires explicit grants to override restrictions and never bypasses superadmin-only permissions',()=>{
  expect(canUseOpsCapability('Operador','agents.publish',{allowed:true,capability:'agents.publish'})).toBe(true);
  expect(canUseOpsCapability('Administrador','agents.publish',{allowed:false,capability:'agents.publish'})).toBe(false);
  expect(canUseOpsCapability('Operador','permissions.manage',{allowed:true,capability:'permissions.manage'})).toBe(false);
 });
 it('normalizes Brazilian phones and rejects invalid contacts',()=>{
  expect(normalizeOpsPhone('(11) 99999-1234')).toBe('5511999991234');
  expect(normalizeOpsPhone('5511999991234')).toBe('5511999991234');
  expect(()=>normalizeOpsPhone('111111')).toThrow();
 });
 it('accepts a complete case identifier only',()=>{
  expect(normalizeOpsCnj('0000000-00.2026.8.26.0001')).toBe('00000000020268260001');
  expect(opsCnjVariants('00000000020268260001')).toEqual(['00000000020268260001','0000000-00.2026.8.26.0001']);
  expect(()=>normalizeOpsCnj('1234')).toThrow();
 });
 it('rejects agent drafts with unauthorized tools, high costs or missing human review',()=>{
  expect(()=>validateOpsAgentDraft({name:'X',instructions:'Ler',tools:['send_whatsapp'],maxCalls:3,humanReview:true})).toThrow();
  expect(()=>validateOpsAgentDraft({name:'X',instructions:'Ler',tools:['read_case'],maxCalls:0,humanReview:true})).toThrow();
  expect(()=>validateOpsAgentDraft({name:'X',instructions:'Ler',tools:['read_case'],maxCalls:3,humanReview:false})).toThrow();
  expect(validateOpsAgentDraft({name:'Revisor',instructions:'Organize o histórico',tools:['read_case'],maxCalls:3,humanReview:true}).name).toBe('Revisor');
 });
 it('validates a public form against configured fields and rejects unknown keys',()=>{
  const fields=[{key:'nome',label:'Nome',type:'text',required:true},{key:'email',label:'E-mail',type:'email',required:true}];
  expect(validateIntakeAnswers(fields,{nome:' Ana ',email:'a@example.com'})).toEqual({nome:'Ana',email:'a@example.com'});
  expect(()=>validateIntakeAnswers(fields,{nome:'',email:'a@example.com'})).toThrow();
  expect(()=>validateIntakeAnswers(fields,{nome:'Ana',email:'a@example.com',admin:true})).toThrow();
 });
 it('refuses transcript persistence without a recording consent record',()=>{
  expect(eligibleForRecording(null,'transcrição')).toBe(false);
  expect(eligibleForRecording('2026-11-12T12:00:00Z','transcrição')).toBe(true);
  expect(eligibleForRecording(null,'')).toBe(true);
 });
});
