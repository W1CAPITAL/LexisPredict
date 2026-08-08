/**
 * Validação de CPF e CNPJ (dígitos verificadores).
 * Fora de "use server" — helpers síncronos não podem ser export de Server Actions.
 */

/** Valida dígito verificador de CPF (1º e 2º). */
export function cpfValido(raw: string): boolean {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let r = ((sum * 10) % 11) % 10;
  if (r !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  r = ((sum * 10) % 11) % 10;
  return r === Number(d[10]);
}

/** Valida dígito verificador de CNPJ (13º e 14º). */
export function cnpjValido(raw: string): boolean {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * w1[i];
  let r = sum % 11;
  const d12 = r < 2 ? 0 : 11 - r;
  if (d12 !== Number(d[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(d[i]) * w2[i];
  r = sum % 11;
  const d13 = r < 2 ? 0 : 11 - r;
  return d13 === Number(d[13]);
}
