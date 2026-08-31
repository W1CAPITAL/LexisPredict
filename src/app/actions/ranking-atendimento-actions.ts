"use server";

/**
 * Hall de Prêmios — ranking do mês.
 * ENTRA: operador, administrador
 * NÃO ENTRA: superadmin, supervisor, sistema interno, W1 CONTROL, trigger db, scanner
 *
 * Fonte: auditoria_logs_app (colunas reais: action, user_nome, auth_user_id, protocolo_ref)
 */

import { getUserContext, getSupabaseAdmin } from "@/lib/server-db";
import { startOfDay, endOfDay } from "date-fns";

const SISTEMA_AUTH = "af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5";

function isSistema(nome: string, auth: string): boolean {
  const a = String(auth || "").trim().toLowerCase();
  if (a === SISTEMA_AUTH.toLowerCase()) return true;
  const n = String(nome || "").toLowerCase().trim();
  return /sistema interno|w1 control|w1 controll|trigger db|^trigger$|^sistema$|^scanner$|^bot$|^cron$/.test(
    n
  );
}

/** true = não entra no hall */
function isCargoFora(cargo: string): boolean {
  const c = String(cargo || "").toLowerCase();
  return /super\s*admin|superadmin|\bsupervisor\b|\bmaster\b/.test(c);
}

function protoKey(p: string) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d : String(p || "").trim().toUpperCase();
}

export async function listarRankingAtendimentoMesAction(): Promise<
  { nome: string; score: number; detalhe?: string }[]
> {
  try {
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return [];

    const admin = await getSupabaseAdmin();
    if (!admin) return [];

    const empresaId = String(ctx.empresa_id);

    // mapa auth → nome + cargos excluídos
    const nameById: Record<string, string> = {};
    const excludedAuth = new Set<string>([SISTEMA_AUTH.toLowerCase()]);

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

        if (isCargoFora(cargo) || isSistema(nome, auth)) {
          if (auth) excludedAuth.add(auth);
          if (id) excludedAuth.add(id);
          continue;
        }
        // operador + administrador (e qualquer outro cargo não excluído)
        if (!nome) continue;
        if (auth) nameById[auth] = nome;
        if (id) nameById[id] = nome;
      }
    } catch {
      /* */
    }

    const now = new Date();
    const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    // logs do mês — schema real
    const logs: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await admin
        .from("auditoria_logs_app")
        .select("auth_user_id, user_nome, protocolo_ref, action, created_at, detalhes")
        .eq("empresa_id", empresaId)
        .in("action", ["atendimento", "encerramento", "edicao"])
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.warn("[hall-ranking]", error.message);
        break;
      }
      const chunk = data || [];
      logs.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 30000) break;
    }

    // se filtro .in(action) falhar por coluna, tenta sem filtro
    if (logs.length === 0) {
      const { data } = await admin
        .from("auditoria_logs_app")
        .select("auth_user_id, user_nome, protocolo_ref, action, created_at, detalhes")
        .eq("empresa_id", empresaId)
        .gte("created_at", monthStart.toISOString())
        .limit(8000);
      for (const row of data || []) {
        const act = String(row.action || "").toLowerCase();
        if (act && !["atendimento", "encerramento", "edicao"].includes(act)) continue;
        if (/scan/.test(act)) continue;
        logs.push(row);
      }
    }

    /** nome display → set de protocolos únicos */
    const byNome = new Map<string, Set<string>>();

    for (const row of logs) {
      const auth = String(row.auth_user_id || "").trim().toLowerCase();
      if (auth && excludedAuth.has(auth)) continue;

      const det = row.detalhes && typeof row.detalhes === "object" ? row.detalhes : {};
      if (det.via === "scan" || det.via_scan || det.sistema === true) continue;

      let nome = String(row.user_nome || "").trim();
      if (auth && nameById[auth]) nome = nameById[auth];

      if (isSistema(nome, auth)) continue;
      if (auth && excludedAuth.has(auth)) continue;

      // sem nome legível: se auth está no mapa de usuários válidos, usa; senão pula
      if (!nome || isSistema(nome, auth) || /^operador\s+[0-9a-f]/i.test(nome)) {
        if (auth && nameById[auth]) nome = nameById[auth];
        else continue;
      }

      // se o auth não está em nameById e o cargo seria excluído, already skipped
      // se auth existe mas não está em nameById (usuário novo / cargo excluído não listado):
      // só conta se não for sistema e tiver nome humano
      if (auth && !nameById[auth] && excludedAuth.has(auth)) continue;

      const proto = protoKey(row.protocolo_ref || det.protocolo || "") || String(row.created_at || Math.random());
      if (!byNome.has(nome)) byNome.set(nome, new Set());
      byNome.get(nome)!.add(proto);
    }

    // fallback: processos.atendido_por no mês
    if (byNome.size === 0) {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, protocolo_ref, updated_at, dados")
        .eq("empresa_id", empresaId)
        .gte("updated_at", monthStart.toISOString())
        .limit(8000);

      for (const row of data || []) {
        const auth = String(row.atendido_por || "").trim().toLowerCase();
        if (!auth || excludedAuth.has(auth)) continue;
        const d = row.dados && typeof row.dados === "object" ? row.dados : {};
        if (d.via_scan_auto_encerrar === true) continue;
        const nome = nameById[auth] || String(d.auditado_por_nome || "").trim();
        if (!nome || isSistema(nome, auth)) continue;
        if (!nameById[auth] && !nome) continue;
        const display = nameById[auth] || nome;
        if (isSistema(display, auth)) continue;
        const proto = protoKey(row.protocolo_ref || auth);
        if (!byNome.has(display)) byNome.set(display, new Set());
        byNome.get(display)!.add(proto);
      }
    }

    // último recurso: qualquer atendido_por mapeável a operador/admin
    if (byNome.size === 0 && Object.keys(nameById).length > 0) {
      const { data } = await admin
        .from("processos")
        .select("atendido_por, protocolo_ref")
        .eq("empresa_id", empresaId)
        .not("atendido_por", "is", null)
        .limit(8000);

      for (const row of data || []) {
        const auth = String(row.atendido_por || "").trim().toLowerCase();
        if (!auth || excludedAuth.has(auth)) continue;
        const nome = nameById[auth];
        if (!nome) continue;
        const proto = protoKey(row.protocolo_ref || auth);
        if (!byNome.has(nome)) byNome.set(nome, new Set());
        byNome.get(nome)!.add(proto);
      }
    }

    return [...byNome.entries()]
      .map(([nome, set]) => ({
        nome,
        score: set.size,
        detalhe: `${set.size} processo(s) no mês`,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  } catch (e: any) {
    console.warn("[hall-ranking]", e?.message);
    return [];
  }
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
