import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('Enriquecimento opcional preserva CNPJ alfanumérico',()=>{
 it('reutiliza o validador oficial e não apaga letras de identificadores cadastrais',()=>{
  const source=readFileSync('src/lib/enrichment-lookup.ts','utf8');
  expect(source).toContain('cnpjValido');
  expect(source).toContain('normalizarCnpj');
  expect(source).not.toContain("cnpj: String(data.cnpj || '').replace(/\\D/g, '') || undefined");
 });
});
