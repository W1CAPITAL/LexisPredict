"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

/**
 * Ranking do mês: quem mais atendeu / editou processos (auditoria ou atendido_por).
 */
export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  // tenta auditoria_logs_app
  try {
    const { data } = await admin
      .from("auditoria_logs_app")
      .select("usuario_nome, auth_user_id, acao, created_at")
      .eq("empresa_id", ctx.empresa_id)
      .gte("created_at", start.toISOString())
      .limit(5000);

    if (data && data.length) {
      const map = new Map<string, { nome: string; score: number }>();
      for (const row of data) {
        const key = String(row.auth_user_id || row.usuario_nome || "ops");
        const nome = String(row.usuario_nome || key);
        const cur = map.get(key) || { nome, score: 0 };
        cur.score += 1;
        map.set(key, cur);
      }
      return [...map.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((r) => ({ nome: r.nome, score: r.score, detalhe: `${r.score} ações no mês` }));
    }
  } catch {
    /* tabela pode não existir / colunas diferentes */
  }

  // fallback: processos com atendido_por
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
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, score]) => ({ nome, score, detalhe: `${score} processos no mês` }));
  } catch {
    return [];
  }
}
