/**
 * Modo Visualização — cargo Visualizador
 * Pode: ver carteira da empresa, cadastrar, editar, navegar em todas as abas operacionais.
 * NÃO pode: copiar texto, exportar/baixar (CSV/XLSX/PDF), usar scanner DataJud/DJEN.
 */
import type { UserRole } from '@/lib/supabase';

export const VIEWER_COPY_BLOCK_MSG =
  'Modo visualização: copiar está desabilitado. Peça a um operador ou supervisor se precisar do texto.';

export const VIEWER_DOWNLOAD_BLOCK_MSG =
  'Modo visualização: download e exportação estão bloqueados neste perfil.';

export const VIEWER_SCAN_BLOCK_MSG =
  'Modo visualização: o scanner tribunal (DataJud/DJEN) está bloqueado neste perfil.';

export function normalizeCargo(cargo: unknown): string {
  return String(cargo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** True se cargo é Visualizador (ou aliases). */
export function checkIfViewer(user: { cargo?: unknown; role?: unknown } | null | undefined): boolean {
  if (!user) return false;
  const c = normalizeCargo(user.cargo ?? user.role);
  return (
    c === 'visualizador' ||
    c === 'viewer' ||
    c === 'somente leitura' ||
    c === 'somente-leitura' ||
    c === 'readonly' ||
    c.includes('visualiz')
  );
}

export function isViewerCargo(cargo: UserRole | string | null | undefined): boolean {
  return checkIfViewer({ cargo });
}
