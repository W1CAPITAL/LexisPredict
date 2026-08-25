"use server";

import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";

export type CarteiraValorRow = {
  id: string;
  protocolo_ref: string | null;
  cliente: string | null;
  categoria: string;
  situacao: string | null;
  valor: number | null;
  fonte: string | null;
  meta: any;
};

export async function listCarteiraValoresAction(): Promise<{
  ok: boolean;
  rows: CarteiraValorRow[];
  error?: string;
}> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { ok: false, rows: [], error: "Sem sessão" };
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, rows: [], error: "Admin indisponível" };
    const { data, error } = await admin
      .from("carteira_valores")
      .select("id, protocolo_ref, cliente, categoria, situacao, valor, fonte, meta")
      .eq("empresa_id", ctx.empresa_id)
      .order("categoria");
    if (error) return { ok: false, rows: [], error: error.message };
    return { ok: true, rows: (data || []) as CarteiraValorRow[] };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || "Erro" };
  }
}
