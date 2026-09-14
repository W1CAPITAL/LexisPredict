/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
import { getSupabaseBrowserClient } from './browser'

/**
 * Cria um cliente Supabase para execução em ambiente Browser (Client Components).
 */
export function createClient() {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Conexão não configurada. Confira as variáveis do Supabase.')
  return client
}
