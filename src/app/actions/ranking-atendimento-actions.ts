"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Só exclui rótulos explícitos de sistema — não exclui UUID de operador. */
function isSistemaInterno(nomeOuId: string): boolean {
  const s = String(nomeOuId || "").trim();
  if (!s) return true;
  const u = s.toUpperCase().replace(/\s+/g, " ");
  if (UUID_RE.test(s)) return false; // UUID de usuário real — resolve depois
  return (
    u === "SISTEMA" ||
    u === "SYSTEM" ||
    u === "SCANNER" ||
    u === "BOT" ||
    u === "CRON" ||
    u === "AUTO" ||
    u === "SISTEMA INTERNO" ||
    u.includes("SISTEMA INTERNO") ||
    u === "W1 CONTROL" ||
    u.includes("W1 CONTROL") ||
    u.includes("OPERACAO DE SISTEMA") ||
    u.includes("OPERAÇÃO DE SISTEMA") ||
    /^SCAN[_\s-]?AUTO/i.test(s)
  );
}

async function buildNomeLookup(admin: any, empresaId: string) {
  const map = new Map<string, string>();

  const put = (u: any) => {
    const full = String(u.nome || "").trim() || String(u.email || "").trim();
    if (!full || isSistemaInterno(full)) return;
    for (const k of [u.auth_user_id, u.id, u.email, u.nome]
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)) {
      map.set(k, full);
      map.set(k.toLowerCase(), full);
      map.set(k.toUpperCase(), full);
    }
  };

  // 1) usuários da empresa
  try {
    const { data } = await admin
      .from("usuarios")
      .select("id, auth_user_id, nome, email, cargo, empresa_id")
      .eq("empresa_id", empresaId);
    for (const u of data || []) put(u);
  } catch {
    /* */
  }

  // 2) se mapa vazio ou incompleto: tenta tabela sem filtro (service role)
  if (map.size < 2) {
    try {
      const { data } = await admin
        .from("usuarios")
        .select("id, auth_user_id, nome, email, cargo, empresa_id")
        .limit(500);
      for (const u of data || []) {
        if (u.empresa_id && String(u.empresa_id) !== String(empresaId)) continue;
        put(u);
      }
    } catch {
      /* */
    }
  }

  return map;
}

function resolveNome(
  lookup: Map<string, string>,
  raw: string,
  nomeHint?: string
): string | null {
  const s = String(raw || "").trim();
  const hint = String(nomeHint || "").trim();
  if (hint && !isSistemaInterno(hint) && !UUID_RE.test(hint)) {
    // prefer human name from audit row
    const fromHint =
      lookup.get(hint) || lookup.get(hint.toUpperCase()) || hint;
    if (fromHint && !isSistemaInterno(fromHint)) return fromHint;
  }
  if (!s || isSistemaInterno(s)) return null;
  const hit =
    lookup.get(s) || lookup.get(s.toLowerCase()) || lookup.get(s.toUpperCase());
  if (hit && !isSistemaInterno(hit)) return hit;
  if (UUID_RE.test(s)) {
    // UUID sem cadastro em usuarios: ainda conta, com rótulo curto legível
    return `Operador ${s.slice(0, 8)}`;
  }
  return s;
}

export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  if (!admin) return [];

  const lookup = await buildNomeLookup(admin, ctx.empresa_id);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  // score keyed by display name
  const score = new Map<string, number>();
  const bump = (raw: string, nomeHint?: string) => {
    const nome = resolveNome(lookup, raw, nomeHint);
    if (!nome || isSistemaInterno(nome)) return;
    score.set(nome, (score.get(nome) || 0) + 1);
  };

  // ——— 1) Auditoria de atendimento (mais fiel ao hall)
  try {
    const { data } = await admin
      .from("auditoria_logs_app")
      .select("usuario_nome, auth_user_id, acao, created_at, detalhes")
      .eq("empresa_id", ctx.empresa_id)
      .gte("created_at", startIso)
      .limit(12000);

    for (const row of data || []) {
      const acao = String(row.acao || "").toLowerCase();
      // conta atendimento e edicao operacional; ignora só scan/sistema
      const det = row.detalhes && typeof row.detalhes === "object" ? row.detalhes : {};
      if (det.via === "scan" || det.via_scan || det.sistema === true) continue;
      if (acao.includes("scan") && !acao.includes("atend")) continue;
      const nomeHint = String(row.usuario_nome || det.por_nome || "");
      if (isSistemaInterno(nomeHint)) continue;
      const raw = String(row.auth_user_id || row.usuario_nome || "").trim();
      if (!raw) continue;
      bump(raw, nomeHint);
    }
  } catch {
    /* */
  }

  // ——— 2) Fallback: processos.atendido_por no mês
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
        // só ignora se o atendimento foi claramente do scanner/sistema
        if (d.via_scan_auto_encerrar === true) continue;
        if (String(d.auditado_por_nome || "").toUpperCase().includes("W1 CONTROL")) continue;
        if (String(d.auditado_por_nome || "").toUpperCase().includes("SISTEMA")) continue;
        const raw = String(row.atendido_por || "").trim();
        if (!raw) continue;
        if (isSistemaInterno(raw)) continue;
        bump(raw, String(d.auditado_por_nome || d.atendido_por_nome || ""));
      }
    } catch {
      /* */
    }
  }

  // ——— 3) Último recurso: qualquer processo com atendido_por (sem filtro de mês)
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
        if (!raw || isSistemaInterno(raw)) continue;
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        bump(raw, String(d.auditado_por_nome || ""));
      }
    } catch {
      /* */
    }
  }

  return [...score.entries()]
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
  if (isSistemaInterno(nome)) return { success: false, message: "Nome reservado ao sistema" };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("usuarios")
    .update({ nome: nome.toUpperCase() })
    .eq("auth_user_id", ctx.auth_id)
    .eq("empresa_id", ctx.empresa_id);
  if (error) return { success: false, message: error.message };
  return { success: true, nome: nome.toUpperCase() };
}
