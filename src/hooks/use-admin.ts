"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import { useAuth } from '@/components/auth/auth-provider';
import { checkIfSuperAdmin, checkIfSupervisor, checkIfViewer } from '@/lib/supabase';

export function useAdmin() {
  const { profile, loading, signOut } = useAuth();

  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isViewer = checkIfViewer(profile);
  // Superadmin herda privilégios de Admin e Operador
  // Visualizador: vê carteira, edita/cadastra, MAS sem export/cópia/scanner
  const isAdmin = profile?.cargo === 'Administrador' || isSuperAdmin || isSupervisor;
  const isOperador = profile?.cargo === 'Operador' || isAdmin || isViewer;

  /** Exportar CSV/XLSX/PDF */
  const canExport = !isViewer && !!profile;
  /** Scanner DataJud/DJEN (manual e nuvem via UI) */
  const canScan = !isViewer && !!profile;
  /** Copiar scripts / rascunhos / texto sensível */
  const canCopy = !isViewer && !!profile;

  const login = async (_password?: string) => {
    console.warn('[useAdmin] login() no client está desativado por segurança. Use verifyMasterPasswordAction.');
    return false;
  };

  return {
    profile,
    loading,
    isAdmin,
    isOperador,
    isSuperAdmin,
    isSupervisor,
    isViewer,
    canExport,
    canScan,
    canCopy,
    login,
    logout: signOut,
    isAuthenticated: !!profile,
  };
}
