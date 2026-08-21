"use server";

/**
 * Ranking de atendimentos da EMPRESA INTEIRA.
 * Só Superadmin/Supervisor. Não usa o array `cases` da UI (que pode ser parcial).
 *
 * Critério = mesmo do app: ultimo_retorno na semana/dia/mês + atendido_por
 * (não created_by).
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
  error?: string;
}> {
  try {
    const { getUserContext, getSupabaseAdmin } = await import("@/lib/server-db");
    const ctx = await getUserContext();
    if (!ctx?.empresa_id) return { ok: false, ranking: [], totalLinhas: 0, error: "sem empresa" };

    // Processos da Empresa: ranking de toda a empresa para quem acessa a página.
    const admin = await getSupabaseAdmin();
    if (!admin) return { ok: false, ranking: [], totalLinhas: 0, error: "admin client" };

    const empresaId = String(ctx.empresa_id);

    // nomes
    const nameById: Record<string, string> = {};
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

    // todas as linhas leves (paginado)
    const pageSize = 1000;
    let offset = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await admin
        .from("processos")
        .select("atendido_por, ultimo_retorno, dados")
        .eq("empresa_id", empresaId)
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("[ranking]", error.message);
        break;
      }
      const chunk = data || [];
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 20000) break;
    }

    const ref = new Date();
    const { start: weekStart, end: weekEnd } = weekBounds(ref);
    const hojeYmd = hojeBrasilYmd(ref);
    const [yy, mm] = hojeYmd.split("-").map((n) => parseInt(n, 10));
    const monthStart = startOfDay(new Date(yy, mm - 1, 1));
    const monthEnd = endOfDay(new Date(yy, mm, 0));

    const counts = new Map<string, { dia: number; semana: number; mes: number }>();

    for (const row of rows) {
      const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
      const raw =
        row.ultimo_retorno ||
        d.ultimoRetorno ||
        d.ultimo_retorno ||
        d.ULTIMO_RETORNO ||
        null;
      if (!raw) continue;
      const dt = parseUltimoAtendimento(String(raw));
      if (!dt) continue;

      const userId = String(
        row.atendido_por || d.atendido_por || d.atendidoPor || ""
      ).trim();
      if (!userId) continue;

      const entry = counts.get(userId) || { dia: 0, semana: 0, mes: 0 };
      if (isAtendidoHoje(String(raw), ref)) entry.dia += 1;
      if (isWithinInterval(dt, { start: weekStart, end: weekEnd })) entry.semana += 1;
      if (isWithinInterval(dt, { start: monthStart, end: monthEnd })) entry.mes += 1;
      counts.set(userId, entry);
    }

    const ranking: RankRow[] = [...counts.entries()]
      .map(([userId, c]) => ({
        userId,
        userNome:
          nameById[userId.toLowerCase()] ||
          nameById[userId] ||
          userId,
        dia: c.dia,
        semana: c.semana,
        mes: c.mes,
      }))
      .filter((r) => r.semana > 0 || r.dia > 0 || r.mes > 0)
      .sort((a, b) => b.semana - a.semana || b.mes - a.mes || b.dia - a.dia)
      .slice(0, limit);

    return { ok: true, ranking, totalLinhas: rows.length };
  } catch (e: any) {
    console.error("[fetchRankingAtendentesEmpresaAction]", e?.message);
    return { ok: false, ranking: [], totalLinhas: 0, error: e?.message };
  }
}
