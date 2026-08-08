"use client";
/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import { useAuth } from '@/components/auth/auth-provider';
import { checkIfSuperAdmin, checkIfSupervisor } from '@/lib/supabase';

export function useAdmin() {
  const { profile, loading, signOut } = useAuth();

  // Superadmin herda privilégios de Admin e Operador
  const isSuperAdmin = checkIfSuperAdmin(profile);
  const isSupervisor = checkIfSupervisor(profile);
  const isAdmin = profile?.cargo === 'Administrador' || isSuperAdmin || isSupervisor;
  const isOperador = profile?.cargo === 'Operador' || isAdmin;
  
  /**
   * Senha mestre NÃO deve ser validada no client (NEXT_PUBLIC_* vaza no browser).
   * Use verifyMasterPasswordAction (server action) em fluxos sensíveis.
   */
  const login = (_password: string) => {
    console.warn('[useAdmin] login() no client está desativado por segurança. Use verifyMasterPasswordAction.');
    return false;
  };

  return { 
    isAdmin, 
    isOperador,
    isSuperAdmin,
    isSupervisor,
    login, 
    logout: signOut, 
    loading,
    profile 
  };
}
