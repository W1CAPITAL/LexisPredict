"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Carrega mapa auth_user_id|id|email|nome → nome completo da empresa. */
async function buildNomeLookup(admin: any, empresaId: string) {
  const map = new Map<string, string>();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, auth_user_id, nome, email")
    .eq("empresa_id", empresaId);
  if (error) {
    // tenta sem filtro se RLS/coluna falhar no service role (ainda assim)
    const { data: all } = await admin.from("usuarios").select("id, auth_user_id, nome, email, empresa_id");
    for (const u of all || []) {
      if (String(u.empresa_id) !== String(empresaId)) continue;
      putUser(map, u);
    }
    return map;
  }
  for (const u of data || []) putUser(map, u);
  return map;
}

function putUser(map: Map<string, string>, u: any) {
  const full = String(u.nome || "").trim() || String(u.email || "").trim();
  if (!full) return;
  const keys = [u.auth_user_id, u.id, u.email, u.nome]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  for (const k of keys) {
    map.set(k, full);
    map.set(k.toLowerCase(), full);
    map.set(k.toUpperCase(), full);
  }
}

function resolveNome(lookup: Map<string, string>, raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "Operador";
  const hit =
    lookup.get(s) ||
    lookup.get(s.toLowerCase()) ||
    lookup.get(s.toUpperCase());
  if (hit) return hit;
  // se for UUID sem match, não exibir UUID cru
  if (UUID_RE.test(s)) return "Operador (cadastro incompleto)";
  return s;
}

export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  const lookup = await buildNomeLookup(admin, ctx.empresa_id);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  // 1) processos.atendido_por (pode ser UUID ou nome)
  try {
    const { data } = await admin
      .from("processos")
      .select("atendido_por, created_by, updated_at")
      .eq("empresa_id", ctx.empresa_id)
      .gte("updated_at", start.toISOString())
      .limit(8000);

    if (data && data.length) {
      const score = new Map<string, number>();
      for (const row of data) {
        const raw = String(row.atendido_por || row.created_by || "").trim();
        if (!raw) continue;
        score.set(raw, (score.get(raw) || 0) + 1);
      }
      if (score.size) {
        return [...score.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([raw, n]) => ({
            nome: resolveNome(lookup, raw),
            score: n,
            detalhe: `${n} processos no mês`,
            auth_user_id: UUID_RE.test(raw) ? raw : null,
          }));
      }
    }
  } catch {
    /* */
  }

  // 2) auditoria
  try {
    const { data } = await admin
      .from("auditoria_logs_app")
      .select("usuario_nome, auth_user_id, acao, created_at")
      .eq("empresa_id", ctx.empresa_id)
      .gte("created_at", start.toISOString())
      .limit(8000);

    if (data && data.length) {
      const score = new Map<string, { raw: string; n: number }>();
      for (const row of data) {
        const raw = String(row.auth_user_id || row.usuario_nome || "").trim();
        if (!raw) continue;
        const cur = score.get(raw) || { raw, n: 0 };
        cur.n += 1;
        score.set(raw, cur);
      }
      return [...score.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 10)
        .map((r) => ({
          nome: resolveNome(lookup, r.raw),
          score: r.n,
          detalhe: `${r.n} ações no mês`,
          auth_user_id: UUID_RE.test(r.raw) ? r.raw : null,
        }));
    }
  } catch {
    /* */
  }

  return [];
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
