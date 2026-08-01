/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl !== '' && 
  supabaseAnonKey !== '';

// Inicialização segura: evita crash se as variáveis estiverem vazias
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export type UserRole = 'Superadmin' | 'Administrador' | 'Operador' | 'Visualizador' | 'Supervisor';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  empresa_id: string;
  nome: string;
  email: string;
  cargo: UserRole;
  role?: string;
  created_at: string;
  avatar_url?: string | null;
}

export interface Empresa {
  id: string;
  nome: string;
  created_at: string;
}

/**
 * Utilitário de Verificação de Autoridade Mestre de Sistema.
 */
export function checkIfSuperAdmin(user: any) {
  if (!user) return false;
  return user.cargo === 'Superadmin' || user.role === 'superadmin';
}

/**
 * Utilitário de Verificação de Visão Master (Supervisor).
 */
export function checkIfSupervisor(user: any) {
  if (!user) return false;
  return user.cargo === 'Supervisor';
}
