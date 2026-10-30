'use server';

import { getUserContext } from "@/lib/server-db";
import { getAtividadesRegistradasCount } from "@/lib/atividades-registradas";

export async function getAtividadesRegistradasCountAction(): Promise<
  { ok: true; count: number } | { ok: false; count: null }
> {
  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id) return { ok: false, count: null };
    const count = await getAtividadesRegistradasCount(String(ctx.empresa_id));
    return { ok: true, count };
  } catch (error) {
    console.error("[atividades-registradas] count failed", error);
    return { ok: false, count: null };
  }
}
