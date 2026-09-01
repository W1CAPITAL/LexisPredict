/**
 * Factory do DataProvider ativo.
 */

import type { DataProvider, ProviderKind } from "./types";
import { loadProviderConfig } from "./config";
import { createLocalProvider } from "./local-provider";
import { createSheetsProvider } from "./sheets-provider";
import { createSupabaseProvider } from "./supabase-provider";

export * from "./types";
export * from "./config";
export { createLocalProvider } from "./local-provider";
export { createSheetsProvider } from "./sheets-provider";
export { createSupabaseProvider } from "./supabase-provider";
export { getLocalSyncQueue, importRowsToLocal } from "./local-provider";

let cached: DataProvider | null = null;
let cachedKind: ProviderKind | null = null;

export function getDataProvider(forceKind?: ProviderKind): DataProvider {
  const kind = forceKind || loadProviderConfig().kind || "supabase";
  if (cached && cachedKind === kind) return cached;
  cachedKind = kind;
  if (kind === "local") cached = createLocalProvider();
  else if (kind === "sheets") cached = createSheetsProvider();
  else cached = createSupabaseProvider();
  return cached;
}

export function resetDataProviderCache() {
  cached = null;
  cachedKind = null;
}
