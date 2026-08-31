"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Auth conhecidos de sistema (não entram no hall). */
const SISTEMA_AUTH_IDS = new Set([
  "af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5", // W1 CONTROL / sistema interno
].map((s) => s.toLowerCase()));

function isSistemaLabel(s: string): boolean {
  const u = String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!u) return true;
  return (
    u === "SISTEMA" ||
    u === "SISTEMA INTERNO" ||
    u.includes("SISTEMA INTERNO") ||
    u === "W1 CONTROL" ||
    u.includes("W1 CONTROL") ||
    u.includes("OPERACAO DE SISTEMA") ||
    u.includes("OPERAÇÃO DE SISTEMA") ||
    u === "SCANNER" ||
    u === "BOT" ||
    u === "CRON" ||
    /^OPERADOR\s+[0-9A-F]{6,}$/i.test(u) // rótulo bugado antigo
  );
}

/** Superadmin e supervisor não entram no Hall de Prêmios. */
function isCargoExcluidoDoHall(cargo: string | null | undefined, role?: string | null): boolean {
  const c = `${cargo || ""} ${role || ""}`.toLowerCase();
  if (!c.trim()) return false;
  return (
    /super\s*admin|superadmin/.test(c) ||
    /\bsupervisor\b/.test(c) ||
    /\bmaster\b/.test(c)
  );
}

type UserMeta = { nome: string; excluded: boolean };

async function buildUserIndex(admin: any, empresaId: string) {
  /** auth_user_id | id → meta */
  const byKey = new Map<string, UserMeta>();
  const excludedIds = new Set<string>();

  const put = (u: any) => {
    const auth = String(u.auth_user_id || "").trim().toLowerCase();
    const id = String(u.id || "").trim().toLowerCase();
    const cargo = String(u.cargo || u.role || u.perfil || "");
    const nome =
      String(u.nome || "").trim() ||
      String(u.email || "").trim() ||
      "";
    const excluded =
      isCargoExcluidoDoHall(cargo, u.role) ||
      isSistemaLabel(nome) ||
      (auth && SISTEMA_AUTH_IDS.has(auth));

    if (auth) {
      if (excluded) excludedIds.add(auth);
      if (nome && !isSistemaLabel(nome)) {
        byKey.set(auth, { nome, excluded });
      } else if (excluded) {
        byKey.set(auth, { nome: nome || "SISTEMA", excluded: true });
      }
    }
    if (id) {
      if (excluded) excludedIds.add(id);
      if (nome && !isSistemaLabel(nome)) {
        byKey.set(id, { nome, excluded });
      }
    }
    if (nome) {
      byKey.set(nome.toLowerCase(), { nome, excluded });
      byKey.set(nome.toUpperCase(), { nome, excluded });
    }
  };

  try {
    const { data } = await admin
      .from("usuarios")
      .select("id, auth_user_id, nome, email, cargo, role, perfil, empresa_id")
      .eq("empresa_id", empresaId);
    for (const u of data || []) put(u);
  } catch {
    try {
      const { data } = await admin
        .from("usuarios")
        .select("id, auth_user_id, nome, email, cargo, role, perfil, empresa_id")
        .limit(800);
      for (const u of data || []) {
        if (String(u.empresa_id) !== String(empresaId)) continue;
        put(u);
      }
    } catch {
      /* */
    }
  }

  // Marca auth de sistema hard-coded
  for (const id of SISTEMA_AUTH_IDS) excludedIds.add(id);

  return { byKey, excludedIds };
}

/**
 * Resolve nome completo. Nunca devolve "Operador abcdef12".
 * null = não entra no ranking.
 */
function resolveDisplayName(
  byKey: Map<string, UserMeta>,
  excludedIds: Set<string>,
  raw: string,
  nomeHint?: string
): string | null {
  const s = String(raw || "").trim();
  const hint = String(nomeHint || "").trim();

  if (s && SISTEMA_AUTH_IDS.has(s.toLowerCase())) return null;
  if (s && excludedIds.has(s.toLowerCase())) return null;
  if (hint && isSistemaLabel(hint)) return null;
  if (hint && isCargoExcluidoDoHall(hint)) return null;

  // 1) lookup por auth / id
  if (s) {
    const meta =
      byKey.get(s) ||
      byKey.get(s.toLowerCase()) ||
      byKey.get(s.toUpperCase());
    if (meta) {
      if (meta.excluded) return null;
      if (meta.nome && !isSistemaLabel(meta.nome) && !UUID_RE.test(meta.nome)) {
        return meta.nome;
      }
    }
  }

  // 2) hint humano da auditoria
  if (hint && !UUID_RE.test(hint) && !isSistemaLabel(hint)) {
    const meta = byKey.get(hint.toLowerCase()) || byKey.get(hint);
    if (meta?.excluded) return null;
    return hint;
  }

  // 3) UUID sem cadastro ou sem nome → NÃO listar (evita "Operador af1b75ea")
  if (UUID_RE.test(s)) return null;

  if (s && !isSistemaLabel(s) && !UUID_RE.test(s)) return s;
  return null;
}

export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  if (!admin) return [];

  const { byKey, excludedIds } = await buildUserIndex(admin, ctx.empresa_id);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const score = new Map<string, number>();
  const bump = (raw: string, nomeHint?: string) => {
    const nome = resolveDisplayName(byKey, excludedIds, raw, nomeHint);
    if (!nome) return;
    score.set(nome, (score.get(nome) || 0) + 1);
  };

  // 1) Auditoria
  try {
    const { data } = await admin
      .from("auditoria_logs_app")
      .select("usuario_nome, auth_user_id, acao, created_at, detalhes")
      .eq("empresa_id", ctx.empresa_id)
      .gte("created_at", startIso)
      .limit(12000);

    for (const row of data || []) {
      const det = row.detalhes && typeof row.detalhes === "object" ? row.detalhes : {};
      if (det.via === "scan" || det.via_scan || det.sistema === true) continue;
      const acao = String(row.acao || "").toLowerCase();
      if (acao.includes("scan") && !acao.includes("atend")) continue;

      const auth = String(row.auth_user_id || "").trim();
      const nomeHint = String(row.usuario_nome || det.por_nome || "").trim();
      if (auth && excludedIds.has(auth.toLowerCase())) continue;
      if (isSistemaLabel(nomeHint)) continue;
      bump(auth || nomeHint, nomeHint);
    }
  } catch {
    /* */
  }

  // 2) Fallback processos.atendido_por no mês
  if (score.size === 0) {
    try {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, updated_at, dados")
        .eq("empresa_id", ctx.empresa_id)
        .gte("updated_at", startIso)
        .limit(8000);

      for (const row of data || []) {
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        const raw = String(row.atendido_por || "").trim();
        if (!raw) continue;
        if (excludedIds.has(raw.toLowerCase())) continue;
        bump(raw, String(d.auditado_por_nome || d.atendido_por_nome || ""));
      }
    } catch {
      /* */
    }
  }

  // 3) Fallback amplo
  if (score.size === 0) {
    try {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, dados")
        .eq("empresa_id", ctx.empresa_id)
        .not("atendido_por", "is", null)
        .limit(8000);

      for (const row of data || []) {
        const raw = String(row.atendido_por || "").trim();
        if (!raw || excludedIds.has(raw.toLowerCase())) continue;
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        bump(raw, String(d.auditado_por_nome || ""));
      }
    } catch {
      /* */
    }
  }

  return [...score.entries()]
    .filter(([nome]) => !isSistemaLabel(nome) && !/^Operador\s+/i.test(nome))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, n]) => ({
      nome,
      score: n,
      detalhe: `${n} ações no período`,
    }));
}

export async function atualizarNomeUsuarioAction(nomeCompleto: string) {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) return { success: false, message: "Sessão expirada" };
  const nome = String(nomeCompleto || "").trim().replace(/\s+/g, " ");
  if (nome.length < 3) return { success: false, message: "Informe o nome completo (mín. 3 caracteres)" };
  if (nome.length > 120) return { success: false, message: "Nome muito longo" };
  if (isSistemaLabel(nome)) return { success: false, message: "Nome reservado ao sistema" };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("usuarios")
    .update({ nome: nome.toUpperCase() })
    .eq("auth_user_id", ctx.auth_id)
    .eq("empresa_id", ctx.empresa_id);
  if (error) return { success: false, message: error.message };
  return { success: true, nome: nome.toUpperCase() };
}
