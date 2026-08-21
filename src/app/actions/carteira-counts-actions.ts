"use server";

/**
 * Contagens da empresa INTEIRA — só COUNT no Postgres (sem baixar 2621 linhas).
 * Use no Dashboard para "Ativos" / "Total". A lista continua limitada.
 */

export type CarteiraCounts = {
  total: number;
  ativos: number;
  encerrados: number;
  empresaId: string | null;
};

export async function fetchCarteiraCountsAction(): Promise<CarteiraCounts> {
  const empty: CarteiraCounts = { total: 0, ativos: 0, encerrados: 0, empresaId: null };
  try {
    const { getUserContext, getSupabaseAdmin, supabase } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return empty;

    let client = await getSupabaseAdmin();
    if (!client) client = supabase as any;
    if (!client) return empty;

    const empresaId = String(ctx.empresa_id);

    const { count: total, error: e1 } = await client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    if (e1) {
      console.error("[fetchCarteiraCountsAction total]", e1.message);
      return { ...empty, empresaId };
    }

    const { count: encerradosFlag } = await client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("datajud_encerrado_tribunal", true);

    let encerradosStatus = 0;
    try {
      const { count: c3 } = await client
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .or("status.ilike.%encerr%,status.ilike.%baix%,status.ilike.%arquiv%");
      encerradosStatus = c3 ?? 0;
    } catch {
      /* status pode não existir */
    }

    const totalN = total ?? 0;
    const encerrados = Math.max(encerradosFlag ?? 0, encerradosStatus);
    const ativos = Math.max(0, totalN - encerrados);

    return { total: totalN, ativos, encerrados, empresaId };
  } catch (e: any) {
    console.error("[fetchCarteiraCountsAction]", e?.message);
    return empty;
  }
}
