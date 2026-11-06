import {describe,it,expect} from 'vitest';
import {extractLegalEntities} from './legal-ner';

describe('Reconhecimento documental de CNPJ numérico e alfanumérico',()=>{
 it('extrai CNPJ alfanumérico da documentação judicial sem descartar letras',()=>{
  const e=extractLegalEntities('Réu inscrito no CNPJ 12.ABC.345/01DE-35, conforme contrato.');
  expect(e.byKind.cnpj).toEqual(['12ABC34501DE35']);
  expect(e.entities.find(x=>x.kind==='cnpj')?.normalized).toBe('12ABC34501DE35');
 });
 it('preserva extração de CNPJ numérico tradicional',()=>{
  const e=extractLegalEntities('CNPJ: 11.222.333/0001-81');
  expect(e.entities.filter(x=>x.kind==='cnpj')).toHaveLength(1);
 });
 it('não apresenta caracteres semelhantes ou dígitos inválidos como identificador confirmado',()=>{
  const e=extractLegalEntities('CNPJ 12.ABC.345/01DE-36, outro 12.ABC.345/01DE-3X');
  expect(e.byKind.cnpj??[]).toEqual([]);
 });
});
