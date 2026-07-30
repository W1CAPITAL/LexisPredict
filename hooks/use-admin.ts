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
   * Validação de senha mestre via Variável de Ambiente.
   * Não utilizar strings hardcoded para evitar bloqueios de segurança.
   */
  const login = (password: string) => {
    const masterPass = process.env.NEXT_PUBLIC_MASTER_PASSWORD;
    return password === masterPass;
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
