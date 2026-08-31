"use server";

/**
 * Hall de Prêmios — operadores e administradores.
 * Fora: superadmin, supervisor, sistema interno / W1 CONTROL / scanner.
 * Nunca exibe "Operador <uuid>".
 */

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SISTEMA_AUTH = new Set(
  ["af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5"].map((s) => s.toLowerCase())
);

function isSistema(nome: string, auth: string): boolean {
  const a = String(auth || "").toLowerCase();
  if (a && SISTEMA_AUTH.has(a)) return true;
  const n = String(nome || "").toLowerCase();
  return /sistema interno|w1 control|^sistema$|^scanner$|^bot$|^cron$|^trigger$/.test(n);
}

function isCargoForaDoHall(cargo: string): boolean {
  const c = String(cargo || "").toLowerCase();
  // administrador e operador ENTRAM; superadmin/supervisor/master NÃO
  return /super\s*admin|superadmin|\bsupervisor\b|\bmaster\b/.test(c);
}

export async function listarRankingAtendimentoMesAction() {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [];

  const admin = await getSupabaseAdmin();
  if (!admin) return [];

  const empresaId = String(ctx.empresa_id);

  // nomes + cargos excluídos
  const nameById: Record<string, string> = {};
  const excludedAuth = new Set<string>([...SISTEMA_AUTH]);

  try {
    const { data: users } = await admin
      .from("usuarios")
      .select("id, auth_user_id, nome, email, cargo, role, perfil")
      .eq("empresa_id", empresaId);

    for (const u of users || []) {
      const auth = String(u.auth_user_id || "").trim().toLowerCase();
      const id = String(u.id || "").trim().toLowerCase();
      const nome = String(u.nome || u.email || "").trim();
      const cargo = String(u.cargo || u.role || u.perfil || "");
      if (isCargoForaDoHall(cargo) || isSistema(nome, auth)) {
        if (auth) excludedAuth.add(auth);
        if (id) excludedAuth.add(id);
        continue;
      }
      if (!nome || isSistema(nome, auth)) continue;
      if (auth) nameById[auth] = nome;
      if (id) nameById[id] = nome;
    }
  } catch {
    /* */
  }

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  // score: nome → set de protocolos (ou contagem simples)
  const byNome = new Map<string, Set<string>>();

  const bump = (authRaw: string, nomeHint: string, proto: string) => {
    const auth = String(authRaw || "").trim().toLowerCase();
    if (auth && excludedAuth.has(auth)) return;
    let nome = (auth && nameById[auth]) || String(nomeHint || "").trim();
    if (auth && nameById[auth]) nome = nameById[auth];
    if (isSistema(nome, auth)) return;
    if (!nome || UUID_RE.test(nome) || /^operador\s+/i.test(nome)) {
      // tenta só pelo mapa; sem nome humano válido → não lista
      if (auth && nameById[auth]) nome = nameById[auth];
      else return;
    }
    if (isSistema(nome, auth)) return;
    if (!byNome.has(nome)) byNome.set(nome, new Set());
    const key = proto || `evt-${byNome.get(nome)!.size}`;
    byNome.get(nome)!.add(key);
  };

  // 1) auditoria — tenta colunas action e acao
  const pullAudit = async (cols: string) => {
    try {
      const { data, error } = await admin
        .from("auditoria_logs_app")
        .select(cols)
        .eq("empresa_id", empresaId)
        .gte("created_at", startIso)
        .limit(8000);
      if (error) return [] as any[];
      return data || [];
    } catch {
      return [] as any[];
    }
  };

  let logs = await pullAudit(
    "auth_user_id, usuario_nome, user_nome, protocolo_ref, acao, action, created_at, detalhes"
  );
  if (!logs.length) {
    logs = await pullAudit("auth_user_id, usuario_nome, protocolo_ref, acao, created_at, detalhes");
  }
  if (!logs.length) {
    logs = await pullAudit("auth_user_id, user_nome, protocolo_ref, action, created_at, detalhes");
  }

  for (const row of logs) {
    const acao = String(row.acao || row.action || "").toLowerCase();
    const det = row.detalhes && typeof row.detalhes === "object" ? row.detalhes : {};
    if (det.via === "scan" || det.via_scan || det.sistema === true) continue;
    // conta atendimento, edicao, encerramento; ignora scan puro
    if (acao && /scan/.test(acao) && !/atend/.test(acao)) continue;
    const auth = String(row.auth_user_id || "").trim();
    const nomeHint = String(row.usuario_nome || row.user_nome || det.por_nome || "").trim();
    const proto = String(row.protocolo_ref || det.protocolo || "").replace(/\D/g, "") || String(row.created_at || "");
    bump(auth, nomeHint, proto);
  }

  // 2) fallback: processos.atendido_por
  if (byNome.size === 0) {
    try {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, protocolo_ref, updated_at, dados")
        .eq("empresa_id", empresaId)
        .gte("updated_at", startIso)
        .limit(8000);
      for (const row of data || []) {
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        const auth = String(row.atendido_por || "").trim();
        if (!auth) continue;
        bump(auth, String(d.auditado_por_nome || ""), String(row.protocolo_ref || ""));
      }
    } catch {
      /* */
    }
  }

  // 3) fallback sem filtro de mês (carteira com atendido_por)
  if (byNome.size === 0) {
    try {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, protocolo_ref, dados")
        .eq("empresa_id", empresaId)
        .not("atendido_por", "is", null)
        .limit(8000);
      for (const row of data || []) {
        const auth = String(row.atendido_por || "").trim();
        if (!auth || excludedAuth.has(auth.toLowerCase())) continue;
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        bump(auth, String(d.auditado_por_nome || ""), String(row.protocolo_ref || row.atendido_por));
      }
    } catch {
      /* */
    }
  }

  return [...byNome.entries()]
    .map(([nome, set]) => ({ nome, score: set.size, detalhe: `${set.size} ações no período` }))
    .filter((r) => r.score > 0 && !isSistema(r.nome, ""))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export async function atualizarNomeUsuarioAction(nomeCompleto: string) {
  const ctx = await getUserContext();
  if (!ctx.auth_id || !ctx.empresa_id) return { success: false, message: "Sessão expirada" };
  const nome = String(nomeCompleto || "").trim().replace(/\s+/g, " ");
  if (nome.length < 3) return { success: false, message: "Informe o nome completo (mín. 3 caracteres)" };
  if (nome.length > 120) return { success: false, message: "Nome muito longo" };
  if (isSistema(nome, "")) return { success: false, message: "Nome reservado ao sistema" };
  const admin = await getSupabaseAdmin();
  const { error } = await admin
    .from("usuarios")
    .update({ nome: nome.toUpperCase() })
    .eq("auth_user_id", ctx.auth_id)
    .eq("empresa_id", ctx.empresa_id);
  if (error) return { success: false, message: error.message };
  return { success: true, nome: nome.toUpperCase() };
}
