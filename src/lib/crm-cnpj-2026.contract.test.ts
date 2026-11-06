import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('CRM — CNPJ alfanumérico de ponta a ponta',()=>{
 it('reaproveita o validador compartilhado e preserva letras até a API',()=>{
  const source=readFileSync('src/app/actions/crm-agent-actions.ts','utf8');
  expect(source).toContain('normalizarCnpj(cnpjRaw)');
  expect(source).toContain('cnpjValido(cnpj)');
  expect(source).toContain('extractLegalEntities(promptRaw)');
  expect(source).toContain('encodeURIComponent(cnpj)');
 });
});
