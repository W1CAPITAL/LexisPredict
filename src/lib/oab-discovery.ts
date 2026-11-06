/**
 * Descoberta assistida: extração local de números CNJ de resultados de portal
 * colados pelo próprio operador, sem acessar sessões, CAPTCHA ou dados externos.
 *
 * Fluxo adaptado de MAAT Monitor / maat/descoberta_oab.py,
 * copyright (c) 2026 Márcio Luis Amorim, licença MIT.
 * Veja docs/THIRD_PARTY_OAB_MAAT.md.
 */
import {cnjEstruturaPlausivel,formatCnjMasked} from './cnj-higiene';

export type OabDiscoveryResults={
 numbers:string[];
 invalid:number;
 duplicates:number;
 truncated:boolean;
};

export function extractCnjFromPastedPortalResults(text:string,limit=200):OabDiscoveryResults {
 const raw=String(text||'');
 const clipped=raw.slice(0,150_000);
 const cap=Number.isFinite(limit)?Math.max(1,Math.min(500,Math.trunc(limit))):200;
 const numbers:string[]=[];
 const seen=new Set<string>();
 let invalid=0,duplicates=0,truncated=clipped.length<raw.length;
 // Não procurar "janelas" de 20 dígitos no meio de números maiores.
 const re=/(?:^|[^\d])(\d{7}[-.]?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4})(?!\d)/g;
 let match:RegExpExecArray|null;
 while((match=re.exec(clipped))!==null){
  const digits=match[1].replace(/\D/g,'');
  if(!cnjEstruturaPlausivel(digits).ok){invalid++;continue;}
  if(seen.has(digits)){duplicates++;continue;}
  seen.add(digits);
  if(numbers.length>=cap){truncated=true;continue;}
  numbers.push(formatCnjMasked(digits));
 }
 return {numbers,invalid,duplicates,truncated};
}
