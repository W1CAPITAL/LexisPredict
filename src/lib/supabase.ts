/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 *
 * Cliente browser com cookies (SSR-compatible) para o middleware ver a sessão.
 * Evita loop login ↔ home quando a sessão ficava só no localStorage.
 */
import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  supabaseUrl !== "" && supabaseAnonKey !== "";

function createLexisClient() {
  if (!isSupabaseConfigured) return null as any;
  // No browser: cookies + localStorage via @supabase/ssr (middleware consegue ler)
  if (typeof window !== "undefined") {
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  // Server/module init: cliente JS simples (sem cookies de request)
  return createSupabaseJsClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createLexisClient();

export type UserRole =
  | "Superadmin"
  | "Administrador"
  | "Operador"
  | "Visualizador"
  | "Supervisor";

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
  const c = String(user.cargo || user.role || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return c === 'supervisor' || c === 'supervisao' || c.includes('supervisor');
}
