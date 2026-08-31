"use server";

import { getUserContext, getProfileByAuthId } from "@/lib/server-db";
import { profileIsentaAnuncio } from "@/lib/ads-exempt";

export async function adsVisibleForSessionAction(): Promise<boolean> {
  try {
    const ctx = await getUserContext();
    if (!ctx?.auth_id) return true;
    const profile = await getProfileByAuthId(ctx.auth_id);
    if (profileIsentaAnuncio(profile as any)) return false;
    return true;
  } catch {
    return true;
  }
}
