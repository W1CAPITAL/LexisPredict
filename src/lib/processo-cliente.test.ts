import { describe, it, expect } from 'vitest';
import { resolveProcessoCliente } from './processo-cliente';
describe('Nome do cliente no processo', () => {
 it('usa a coluna quando preenchida', () => {
   expect(resolveProcessoCliente({ cliente: 'MARIA', cliente_json: 'ANA' })).toBe('MARIA');
 });
 it('usa a projeção pequena do JSON legado', () => {
   expect(resolveProcessoCliente({ cliente: null, cliente_json: ' JOÃO SILVA ' })).toBe('JOÃO SILVA');
   expect(resolveProcessoCliente({ cliente: '', cliente_upper: 'JOANA' })).toBe('JOANA');
 });
 it('recupera de JSON completo no formulário detalhado', () => {
   expect(resolveProcessoCliente({ cliente: '', dados: { CLIENTE: 'PEDRO' } })).toBe('PEDRO');
 });
 it('não trata marcador de ausência como nome verdadeiro', () => {
   expect(resolveProcessoCliente({ cliente: 'SEM NOME', dados: { cliente: 'LUISA' } })).toBe('LUISA');
 });
});
