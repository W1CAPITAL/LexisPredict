/** Empresa principal W1 Capital — só nela exibe legenda Davi Alves Figueredo */
export const W1_EMPRESA_PRINCIPAL_ID = 'd37fd4bb-1c71-4dca-b97e-292355918d39';

export function isEmpresaW1Principal(empresaId?: string | null): boolean {
  if (!empresaId) return false;
  return String(empresaId).toLowerCase() === W1_EMPRESA_PRINCIPAL_ID.toLowerCase();
}

export function legendaW1Control(empresaId?: string | null): string {
  if (isEmpresaW1Principal(empresaId)) {
    return 'Feito por Davi Alves Figueredo · scanner automático';
  }
  return 'W1 CONTROL · scanner automático';
}
