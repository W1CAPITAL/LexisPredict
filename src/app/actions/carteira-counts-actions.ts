"use server";

export type CarteiraCounts = {
  total: number;
  ativos: number;
  encerrados: number;
  empresaId: string | null;
  /** true se o total é da empresa inteira (só superadmin/supervisor) */
  isEmpresaWide: boolean;
};

/**
 * Contagem alinhada ao escopo do usuário:
 * - Superadmin / Supervisor → COUNT de toda a empresa
 * - Demais cargos → COUNT só dos processos do usuário (created_by / atendido_por)
 */
export async function fetchCarteiraCountsAction(): Promise<CarteiraCounts> {
  const empty: CarteiraCounts = {
    total: 0,
    ativos: 0,
    encerrados: 0,
    empresaId: null,
    isEmpresaWide: false,
  };
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return empty;
    const client = await getSupabaseAdmin();
    if (!client) return empty;

    const empresaId = String(ctx.empresa_id);
    const wide = !!(ctx.isSuperAdmin || ctx.isSupervisor);
    const authId = ctx.auth_id ? String(ctx.auth_id) : null;

    let q = client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    if (!wide && authId) {
      q = q.or(`created_by.eq.${authId},atendido_por.eq.${authId}`);
    }

    const { count: total, error } = await q;
    if (error) {
      console.error("[fetchCarteiraCountsAction]", error.message);
      return { ...empty, empresaId, isEmpresaWide: wide };
    }

    let encQ = client
      .from("processos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("datajud_encerrado_tribunal", true);

    if (!wide && authId) {
      encQ = encQ.or(`created_by.eq.${authId},atendido_por.eq.${authId}`);
    }

    const { count: enc } = await encQ;
    const totalN = total ?? 0;
    const encerrados = enc ?? 0;

    return {
      total: totalN,
      ativos: Math.max(0, totalN - encerrados),
      encerrados,
      empresaId,
      isEmpresaWide: wide,
    };
  } catch (e: any) {
    console.error("[fetchCarteiraCountsAction]", e?.message);
    return empty;
  }
}
