'use server';

import { getSupabaseAdmin, getUserContext } from "@/lib/server-db";
import { getAtividadesRegistradasPorResponsavel, type AtividadesResponsavelResumo } from "@/lib/atividades-registradas";

export type AtividadeResponsavelKpi = AtividadesResponsavelResumo & {
  userId: string;
  nome: string;
};

export async function getAtividadesRegistradasCountAction(): Promise<
  { ok: true; count: number; responsaveis: AtividadeResponsavelKpi[] }
  | { ok: false; count: null; responsaveis: [] }
> {
  try {
    const ctx = await getUserContext();
    if (!ctx.auth_id || !ctx.empresa_id) return { ok: false, count: null, responsaveis: [] };

    const empresaId = String(ctx.empresa_id);
    const resumo = await getAtividadesRegistradasPorResponsavel(empresaId);
    const ids = Object.keys(resumo);
    const db = await getSupabaseAdmin();
    const { data: profiles, error } = ids.length
      ? await db.from("usuarios").select("auth_user_id,nome").eq("empresa_id", empresaId).in("auth_user_id", ids)
      : { data: [], error: null };
    if (error) throw new Error("Falha ao carregar nomes dos responsáveis: " + error.message);

    const names = new Map((profiles || []).map(p => [String(p.auth_user_id), String(p.nome || "Usuário sem nome")]));
    const responsaveis: AtividadeResponsavelKpi[] = ids
      .map(userId => ({
        userId,
        nome: names.get(userId) || "Usuário sem nome",
        ...resumo[userId],
      }))
      .filter(x => x.registros > 0)
      .sort((a, b) => b.registros - a.registros || a.nome.localeCompare(b.nome, "pt-BR"));

    const count = responsaveis.reduce((sum, item) => sum + item.registros, 0);
    return { ok: true, count, responsaveis };
  } catch (error) {
    console.error("[atividades-registradas] breakdown failed", error);
    return { ok: false, count: null, responsaveis: [] };
  }
}
