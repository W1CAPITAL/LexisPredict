/**
 * Balanced, opt-in sharding for independent operational data.
 * Auth, tenant permissions, users and processes remain on the PRIMARY Supabase.
 * Every shard is accessed on the server with service-role credentials ONLY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type DatabaseClient = SupabaseClient<any>;
export type DatabaseShard = 'primary' | 'secondary';
export type ShardClient = { shard: DatabaseShard; client: DatabaseClient };

let cached: { config: string; clients: ShardClient[] } | null = null;

export function isDualDbEnabled(): boolean {
  return process.env.LEXIS_DUAL_DB_MODE === 'sharded';
}

/** Stable hash: every message from the same Brazilian phone stays on one shard.
 * Last 8 digits keep with/without country code and the optional 9th digit together.
 * A stable hash approximates 50/50 across many contacts; it does not balance bytes/CPU.
 */
export function shardForPhone(phone: string): DatabaseShard {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) throw new Error('Telefone inválido para roteamento');
  const key = digits.slice(-8);
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? 'primary' : 'secondary';
}

function createAdmin(url: string, key: string): DatabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getWaReadClients(): ShardClient[] {
  const dual = isDualDbEnabled();
  const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const secondaryUrl = process.env.LEXIS_SECONDARY_SUPABASE_URL || '';
  const secondaryKey = process.env.LEXIS_SECONDARY_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!primaryUrl || !primaryKey) throw new Error('Banco primário não configurado');
  // Never silently fall back to the primary once sharding is enabled.
  if (dual && (!secondaryUrl || !secondaryKey)) throw new Error('Segundo banco não configurado; sharding suspenso');
  if (dual && primaryUrl.replace(/\/$/, '') === secondaryUrl.replace(/\/$/, '')) {
    throw new Error('Os dois bancos precisam ser projetos distintos');
  }

  const config = [dual ? 'dual' : 'single', primaryUrl, primaryKey, dual ? secondaryUrl : '', dual ? secondaryKey : ''].join('|');
  if (cached?.config === config) return cached.clients;
  const clients: ShardClient[] = [{ shard: 'primary', client: createAdmin(primaryUrl, primaryKey) }];
  if (dual) clients.push({ shard: 'secondary', client: createAdmin(secondaryUrl, secondaryKey) });
  cached = { config, clients };
  return clients;
}

export function getWaWriteClient(phone: string): ShardClient {
  const clients = getWaReadClients();
  if (clients.length === 1) return clients[0];
  const target = shardForPhone(phone);
  const selected = clients.find(c => c.shard === target);
  if (!selected) throw new Error('Shard escolhido indisponível');
  return selected;
}

/** Raw provider payloads can be huge; in dual mode store only compact fields by default. */
export function shouldStoreWhatsAppRaw(): boolean {
  return !isDualDbEnabled() || process.env.LEXIS_WA_STORE_RAW === 'true';
}

/**
 * Per-event telemetry placement. Unlike contact-affine WhatsApp messages,
 * scans and alerts have no cross-event transactional requirement, so each
 * independent event is hashed separately to reduce hot-contact skew.
 */
export function shardForTelemetryEvent(eventId: string): DatabaseShard {
  const key = String(eventId || '').trim();
  if (!key) throw new Error('Identificador de telemetria obrigatório');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? 'primary' : 'secondary';
}

export function getTelemetryWriteClient(eventId: string): ShardClient {
  const clients = getWaReadClients();
  if (clients.length === 1) return clients[0];
  const target = shardForTelemetryEvent(eventId);
  const selected = clients.find(c => c.shard === target);
  if (!selected) throw new Error('Banco de telemetria indisponível');
  return selected;
}
