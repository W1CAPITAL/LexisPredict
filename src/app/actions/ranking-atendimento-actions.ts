"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

async function mapAuthToNome(admin: any, empresaId: string, authIds: string[]) {
  const map = new Map<string, string>();
  if (!authIds.length) return map;
  const { data } = await admin
    .from("usuarios")
    .select("auth_user_id, nome, email")
    .eq("empresa_id", empresaId)
    .in("auth_user_id", authIds);
  for (const u of data || []) {
    const full = String(u.nome || "").trim() || String(u.email || "").trim();
    if (u.auth_user_id && full) map.set(String(u.auth_user_id), full);
  }
  return map;
}

/** Ranking do mês com nome completo do usuário (tabela usuarios). */
export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  try {
    const { data } = await admin
      .from("auditoria_logs_app")
      .select("usuario_nome, auth_user_id, acao, created_at")
      .eq("empresa_id", ctx.empresa_id)
      .gte("created_at", start.toISOString())
      .limit(5000);

    if (data && data.length) {
      const scoreMap = new Map<string, { auth: string; nomeHint: string; score: number }>();
      for (const row of data) {
        const auth = String(row.auth_user_id || "").trim();
        const key = auth || String(row.usuario_nome || "ops");
        const cur = scoreMap.get(key) || {
          auth,
          nomeHint: String(row.usuario_nome || "").trim(),
          score: 0,
        };
        cur.score += 1;
        if (!cur.nomeHint && row.usuario_nome) cur.nomeHint = String(row.usuario_nome).trim();
        scoreMap.set(key, cur);
      }
      const auths = [...scoreMap.values()].map((v) => v.auth).filter(Boolean);
      const nomes = await mapAuthToNome(admin, ctx.empresa_id, auths);
      return [...scoreMap.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((r) => ({
          nome: (r.auth && nomes.get(r.auth)) || r.nomeHint || r.auth || "Operador",
          score: r.score,
          detalhe: `${r.score} ações no mês`,
          auth_user_id: r.auth || null,
        }));
    }
  } catch {
    /* */
  }

  try {
    const { data } = await admin
      .from("processos")
      .select("atendido_por, updated_at")
      .eq("empresa_id", ctx.empresa_id)
      .gte("updated_at", start.toISOString())
      .limit(3000);
    const map = new Map<string, number>();
    for (const row of data || []) {
      const n = String(row.atendido_por || "").trim();
      if (!n) continue;
      map.set(n, (map.get(n) || 0) + 1);
    }
    // resolve atendido_por as nome or match usuarios
    const { data: users } = await admin
      .from("usuarios")
      .select("auth_user_id, nome, email")
      .eq("empresa_id", ctx.empresa_id);
    const byPartial = new Map<string, string>();
    for (const u of users || []) {
      const full = String(u.nome || "").trim();
      if (full) {
        byPartial.set(full.toUpperCase(), full);
        byPartial.set(String(u.email || "").toUpperCase(), full);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([raw, score]) => ({
        nome: byPartial.get(raw.toUpperCase()) || raw,
        score,
        detalhe: `${score} processos no mês`,
      }));
  } catch {
    return [];
  }
}

export async function atualizarNomeUsuarioAction(nomeCompleto: string) {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) return { success: false, message: "Sessão expirada" };
  const nome = String(nomeCompleto || "").trim().replace(/\s+/g, " ");
  if (nome.length < 3) return { success: false, message: "Informe o nome completo (mín. 3 caracteres)" };
  if (nome.length > 120) return { success: false, message: "Nome muito longo" };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("usuarios")
    .update({ nome: nome.toUpperCase() })
    .eq("auth_user_id", ctx.auth_id)
    .eq("empresa_id", ctx.empresa_id);
  if (error) return { success: false, message: error.message };
  return { success: true, nome: nome.toUpperCase() };
}
