"use server";

import { enrichmentStatus } from "@/lib/enrichment-lookup";

/** Status do enrich — sempre opcional; nunca bloqueia o gerador. */
export async function enrichmentConfigAction() {
  return enrichmentStatus();
}
