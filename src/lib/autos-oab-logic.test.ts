import {describe,it,expect} from 'vitest';
import {canonicalCnj, extractAutosDocuments, chronologicalThroughContestacao, getDocumentLabel} from './autos-oab-logic';

describe('Scanner de autos OAB: seleção documental',()=>{
 it('valida CNJ de 20 dígitos e normaliza com máscara',()=>{
  expect(canonicalCnj('80076177720238050154')).toBe('8007617-77.2023.8.05.0154');
  expect(canonicalCnj('8007617-77.2023.8.05.0154')).toBe('8007617-77.2023.8.05.0154');
  expect(canonicalCnj('123abc')).toBeNull();
 });
 it('reconhece petição inicial, contestação e anexos sem inferir quem assinou',()=>{
  const docs=extractAutosDocuments({items:[
   {id:1,titulo:'Petição Inicial',data:'2026-01-10 10:00:00',key:'dGVzdGU='},
   {id:2,titulo:'Contestação com documentos',data:'2026-02-10 12:00:00',key:'YXBvcnQ='},
   {id:3,titulo:'Certidão',data:'2026-03-10 09:00:00',key:'c2lnbm8='},
  ]});
  expect(docs).toHaveLength(3);
  expect(docs[1].tipoDetectado).toBe('contestacao');
  expect(getDocumentLabel(docs[1])).toMatch(/contesta/i);
  const segment=chronologicalThroughContestacao(docs);
  expect(segment.docs.map(x=>x.id)).toEqual(['1','2']);
  expect(segment.foundContestacao).toBe(true);
  expect(segment.contestacaoIsBancoConfirmed).toBe(false);
 });
 it('não mascara ausência de contestação como captura completa',()=>{
  const docs=extractAutosDocuments({items:[{id:9,titulo:'Petição Inicial',data:'2026-01-10',key:'eA=='}]});
  const result=chronologicalThroughContestacao(docs);
  expect(result.foundContestacao).toBe(false);
  expect(result.docs).toHaveLength(1);
 });
 it('recusa chaves malformadas e dados sem identidade para download',()=>{
  expect(extractAutosDocuments({items:[{titulo:'Contestação',data:'2026-01-10',key:'../../etc/passwd'}]})).toHaveLength(0);
 });
});
