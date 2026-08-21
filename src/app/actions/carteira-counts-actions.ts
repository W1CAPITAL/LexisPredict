"use server";

export type CarteiraCounts = {
  total: number;
  ativos: number;
  encerrados: number;
  empresaId: string | null;
};

/** Total real da empresa — COUNT no Postgres, sem teto de lista. */
export async function fetchCarteiraCountsAction(): Promise<CarteiraCounts> {
  const empty: CarteiraCounts = { total: 0, ativos: 0, encerrados: 0, empresaId: null };
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return empty;
    const client = await getSupabaseAdmin();
    if (!client) return empty;
    const empresaId = String(ctx.empresa_id);

    const { count: total, error } = await client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);
    if (error) {
      console.error("[fetchCarteiraCountsAction]", error.message);
      return { ...empty, empresaId };
    }
    const { count: enc } = await client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("datajud_encerrado_tribunal", true);

    const totalN = total ?? 0;
    const encerrados = enc ?? 0;
    return {
      total: totalN,
      ativos: Math.max(0, totalN - encerrados),
      encerrados,
      empresaId,
    };
  } catch (e: any) {
    console.error("[fetchCarteiraCountsAction]", e?.message);
    return empty;
  }
}
