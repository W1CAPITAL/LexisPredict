"use server";

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Atendimentos de sistema / scanner / W1 CONTROL — não entram no Hall de Prêmios. */
function isSistemaInterno(nomeOuId: string): boolean {
  const s = String(nomeOuId || "").trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (
    /^(SISTEMA|SYSTEM|SCANNER|BOT|CRON|AUTO|N\/A|NULL|UNDEFINED)$/i.test(s) ||
    /SISTEMA\s*INTERNO/i.test(s) ||
    /W1\s*CONTROL/i.test(s) ||
    /OPERA[CÇ][AÃ]O\s*DE\s*SISTEMA/i.test(s) ||
    /SCAN[_\s-]?AUTO/i.test(s) ||
    u === "SISTEMA INTERNO" ||
    u.includes("SISTEMA INTERNO")
  ) {
    return true;
  }
  return false;
}

async function buildNomeLookup(admin: any, empresaId: string) {
  const map = new Map<string, string>();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, auth_user_id, nome, email, cargo")
    .eq("empresa_id", empresaId);
  const rows =
    data ||
    (error
      ? (
          await admin
            .from("usuarios")
            .select("id, auth_user_id, nome, email, cargo, empresa_id")
        ).data?.filter((u: any) => String(u.empresa_id) === String(empresaId))
      : []);
  for (const u of rows || []) {
    const full = String(u.nome || "").trim() || String(u.email || "").trim();
    if (!full) continue;
    if (isSistemaInterno(full) || isSistemaInterno(String(u.cargo || ""))) continue;
    for (const k of [u.auth_user_id, u.id, u.email, u.nome].map((x) => String(x || "").trim()).filter(Boolean)) {
      map.set(k, full);
      map.set(k.toLowerCase(), full);
      map.set(k.toUpperCase(), full);
    }
  }
  return map;
}

function resolveNome(lookup: Map<string, string>, raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s || isSistemaInterno(s)) return null;
  const hit =
    lookup.get(s) || lookup.get(s.toLowerCase()) || lookup.get(s.toUpperCase());
  if (hit) {
    if (isSistemaInterno(hit)) return null;
    return hit;
  }
  if (UUID_RE.test(s)) return null; // UUID sem usuário humano = não ranking
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

  const score = new Map<string, number>();

  const bump = (raw: string) => {
    const nome = resolveNome(lookup, raw);
    if (!nome) return;
    score.set(nome, (score.get(nome) || 0) + 1);
  };

  try {
    const { data } = await admin
      .from("processos")
      .select("atendido_por, created_by, updated_at, dados")
      .eq("empresa_id", ctx.empresa_id)
      .gte("updated_at", start.toISOString())
      .limit(8000);

    for (const row of data || []) {
      const d = row.dados && typeof row.dados === "object" ? row.dados : {};
      // skip scanner / operação de sistema
      if (
        d.via_scan_auto_encerrar ||
        d.operacao_sistema ||
        row.dados?.operacao_sistema ||
        isSistemaInterno(String(d.auditado_por_nome || ""))
      ) {
        continue;
      }
      const raw = String(row.atendido_por || "").trim();
      if (raw) bump(raw);
    }
  } catch {
    /* */
  }

  if (score.size === 0) {
    try {
      const { data } = await admin
        .from("auditoria_logs_app")
        .select("usuario_nome, auth_user_id, acao, created_at, detalhes")
        .eq("empresa_id", ctx.empresa_id)
        .gte("created_at", start.toISOString())
        .limit(8000);

      for (const row of data || []) {
        const det = row.detalhes && typeof row.detalhes === "object" ? row.detalhes : {};
        if (det.via === "scan" || det.via_scan || det.sistema) continue;
        const nomeHint = String(row.usuario_nome || "");
        if (isSistemaInterno(nomeHint)) continue;
        bump(String(row.auth_user_id || row.usuario_nome || "").trim());
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
      detalhe: `${n} processos no mês`,
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
