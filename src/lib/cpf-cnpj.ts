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

/** CNPJ alfanumérico (12 posições letras/dígitos, 2 DVs numéricos).
 * Cálculo oficial da RFB: valor ASCII - 48 e módulo 11 com pesos 2–9.
 * Mantém compatibilidade integral com CNPJ numérico.
 * https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj
 */
export function cnpjValido(raw: string): boolean {
  const cnpj=String(raw||'').toUpperCase().replace(/[.\/\s-]/g,'');
  if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj))return false;

  const w1=[5,4,3,2,9,8,7,6,5,4,3,2];
  const w2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
  const values=[...cnpj].map(ch=>ch.charCodeAt(0)-48);
  const digit=(count:number,weights:readonly number[])=>{
    const sum=values.slice(0,count).reduce((total,v,i)=>total+v*weights[i],0);
    const remainder=sum%11;
    return remainder<2?0:11-remainder;
  };
  return values[12]===digit(12,w1)&&values[13]===digit(13,w2);
}
