import { describe, it, expect } from 'vitest';
import { cpfValido, cnpjValido } from './cpf-cnpj';

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
