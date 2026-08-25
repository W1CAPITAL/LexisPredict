"use server";

/**
 * Ranking Top Atendentes — empresa inteira.
 * Fonte: coluna atendido_por + ultimo_retorno (não amostra da UI).
 */

import {
  isAtendidoHoje,
  parseUltimoAtendimento,
  weekBounds,
  hojeBrasilYmd,
} from "@/lib/atendimento-semana";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

export type RankRow = {
  userId: string;
  userNome: string;
  dia: number;
  semana: number;
  mes: number;
};

export async function fetchRankingAtendentesEmpresaAction(limit = 5): Promise<{
  ok: boolean;
  ranking: RankRow[];
  totalLinhas: number;
  total?: number;
  ativos?: number;
  atendidosSemana?: number;
  error?: string;
}> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) {
      return { ok: false, ranking: [], totalLinhas: 0, error: "sem empresa" };
    }
    const admin = await getSupabaseAdmin();
    if (!admin) {
      return { ok: false, ranking: [], totalLinhas: 0, error: "admin" };
    }

    const empresaId = String(ctx.empresa_id);

    let total = 0;
    try {
      const { count } = await admin
        .from("processos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      total = count ?? 0;
    } catch {
      total = 0;
    }

    // nomes
    const nameById: Record<string, string> = {};
    try {
      const { data: users } = await admin
        .from("usuarios")
        .select("id, auth_user_id, nome, email")
        .eq("empresa_id", empresaId);
      for (const u of users || []) {
        const nome = String(u.nome || u.email || "").trim();
        if (!nome) continue;
        if (u.id) nameById[String(u.id).toLowerCase()] = nome;
        if (u.auth_user_id) nameById[String(u.auth_user_id).toLowerCase()] = nome;
      }
    } catch {
      /* */
    }
    const W1 = "af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5";
    nameById[W1] = nameById[W1] || "W1 CONTROL";
    nameById[W1.toLowerCase()] = nameById[W1];

    // Pagina todos os que têm retorno (pode ser DATE ou text)
    const pageSize = 1000;
    let offset = 0;
    const rows: { atendido_por: any; ultimo_retorno: any }[] = [];
    for (;;) {
      const { data, error } = await admin
        .from("processos")
        .select("atendido_por, ultimo_retorno")
        .eq("empresa_id", empresaId)
        .not("ultimo_retorno", "is", null)
        .not("atendido_por", "is", null)
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("[ranking]", error.message);
        break;
      }
      const chunk = data || [];
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 30000) break;
    }

    const ref = new Date();
    const { start: weekStart, end: weekEnd } = weekBounds(ref);
    const hojeYmd = hojeBrasilYmd(ref);
    const [yy, mm] = hojeYmd.split("-").map((n) => parseInt(n, 10));
    const monthStart = startOfDay(new Date(yy, mm - 1, 1));
    const monthEnd = endOfDay(new Date(yy, mm, 0));

    let atendidosSemana = 0;
    const counts = new Map<string, { dia: number; semana: number; mes: number }>();

    for (const row of rows) {
      const raw =
        row.ultimo_retorno != null
          ? String(row.ultimo_retorno).slice(0, 10) // DATE ou ISO
          : null;
      if (!raw) continue;
      const dt = parseUltimoAtendimento(raw);
      if (!dt) continue;

      const userId = String(row.atendido_por || "").trim();
      if (!userId) continue;

      const entry = counts.get(userId) || { dia: 0, semana: 0, mes: 0 };
      if (isAtendidoHoje(raw, ref)) entry.dia += 1;
      if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) {
        entry.semana += 1;
        atendidosSemana += 1;
      }
      if (isWithinInterval(dt, { start: monthStart, end: monthEnd })) entry.mes += 1;
      counts.set(userId, entry);
    }

    const ranking: RankRow[] = [...counts.entries()]
      .map(([userId, c]) => ({
        userId,
        userNome: nameById[userId.toLowerCase()] || nameById[userId] || userId,
        dia: c.dia,
        semana: c.semana,
        mes: c.mes,
      }))
      .filter((r) => r.semana > 0 || r.dia > 0 || r.mes > 0)
      .sort((a, b) => b.semana - a.semana || b.mes - a.mes || b.dia - a.dia)
      .slice(0, Math.max(1, limit));

    return {
      ok: true,
      ranking,
      totalLinhas: rows.length,
      total,
      atendidosSemana,
    };
  } catch (e: any) {
    console.error("[fetchRankingAtendentesEmpresaAction]", e?.message);
    return { ok: false, ranking: [], totalLinhas: 0, error: e?.message };
  }
}
