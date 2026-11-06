import {describe,it,expect} from 'vitest';
import {validateAssinafyPdf,normalizeAssinafyName} from './assinafy-upload';

const pdf=new Uint8Array([37,80,68,70,45,49,46,55,10,37,69,79,70,10]);
describe('Assinafy: validação de upload sem enviar dados',()=>{
 it('aceita PDF real abaixo de 25 MiB',()=>{
  expect(validateAssinafyPdf(pdf,'Contrato jurídico.pdf')).toEqual({ok:true,name:'Contrato juridico.pdf'});
 });
 it('bloqueia conteúdo sem assinatura PDF e extensão diferente',()=>{
  expect(validateAssinafyPdf(new Uint8Array([0,1,2,3,4]),'contrato.pdf').ok).toBe(false);
  expect(validateAssinafyPdf(pdf,'contrato.exe').ok).toBe(false);
 });
 it('bloqueia PDF vazio e acima de 25 MiB',()=>{
  expect(validateAssinafyPdf(new Uint8Array(), 'a.pdf').ok).toBe(false);
  const large=new Uint8Array(25*1024*1024+1);
  large.set(pdf);
  expect(validateAssinafyPdf(large,'a.pdf').ok).toBe(false);
 });
 it('remove caracteres inseguros do nome sem alterar o PDF',()=>{
  expect(normalizeAssinafyName('../Procuracao <teste>.pdf')).toBe('Procuracao _teste_.pdf');
 });
});
