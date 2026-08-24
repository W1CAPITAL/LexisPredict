import type { LegalCase } from './case-logic';
export function isSentencaProcedente(c: LegalCase): boolean {
  const t = `${(c as any).evento_tipo || ''} ${(c as any).evento_resumo || ''} ${(c as any).datajud_ultimo_nome || ''}`.toUpperCase();
  if (t.includes('IMPROCEDENTE')) return false;
  return t.includes('PROCEDENTE') && !t.includes('IMPROCEDENTE');
}
export function isSentencaImprocedente(c: LegalCase): boolean {
  const t = `${(c as any).evento_tipo || ''} ${(c as any).evento_resumo || ''} ${(c as any).datajud_ultimo_nome || ''}`.toUpperCase();
  return t.includes('IMPROCEDENTE');
}
