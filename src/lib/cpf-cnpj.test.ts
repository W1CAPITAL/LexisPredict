import { describe, it, expect } from 'vitest';
import { cpfValido, cnpjValido, normalizarCnpj } from './cpf-cnpj';

describe('cpfValido', () => {
  it('aceita CPF válido conhecido', () => {
    // 529.982.247-25
    expect(cpfValido('52998224725')).toBe(true);
  });
  it('rejeita sequência repetida', () => {
    expect(cpfValido('11111111111')).toBe(false);
  });
  it('rejeita tamanho errado', () => {
    expect(cpfValido('123')).toBe(false);
  });
});

describe('cnpjValido', () => {
  it('rejeita sequência repetida', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  it('rejeita tamanho errado', () => {
    expect(cnpjValido('123')).toBe(false);
  });
});

describe('cnpjValido — formato alfanumérico Receita Federal 2026', () => {
  it('preserva CNPJ numérico validado anteriormente', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
  });
  it('aceita letras nas primeiras 12 posições e DV numérico, sem quebrar formatação', () => {
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
    expect(cnpjValido('12.ABC.345/01DE-35')).toBe(true);
    expect(cnpjValido('12.abc.345/01de-35')).toBe(true);
  });
  it('rejeita dígitos errados, caracteres extras e máscaras malformadas', () => {
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
    expect(cnpjValido('12ABC34501DE3X')).toBe(false);
    expect(cnpjValido('CNPJ: 12ABC34501DE35')).toBe(false);
    expect(cnpjValido('12ABC34501DE35<script>')).toBe(false);
  });
});

describe('normalizarCnpj',()=>{
 it('preserva letras em maiúsculas na pesquisa e nos cadastros',()=>{
   expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
 });
 it('não descarta letras de um CNPJ válido silenciosamente',()=>{
   expect(normalizarCnpj('11.222.333/0001-81')).toBe('11222333000181');
 });
});
