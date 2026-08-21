"use server";

/**
 * Ranking de atendimentos da EMPRESA INTEIRA (Processos da Empresa).
 * Agrega no servidor — NÃO usa o array `cases` da UI.
 *
 * Critério alinhado ao SQL do gabinete:
 * - data: ultimo_retorno (coluna ou dados.ultimoRetorno)
 * - quem: atendido_por; se vazio (legado), created_by
 * - nome: usuarios.id + auth_user_id
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

export type EmpresaMetrics = {
  total: number;
  ativos: number;
  atendidosSemana: number;
  ranking: RankRow[];
};

function pickRetorno(row: any): string | null {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  const raw =
    row?.ultimo_retorno ||
    d.ultimoRetorno ||
    d.ultimo_retorno ||
    d.ULTIMO_RETORNO ||
    d.ultimoAtendimento ||
    null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

function pickUserKey(row: any): string {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  const key =
    row?.atendido_por ||
    d.atendido_por ||
    d.atendidoPor ||
    row?.created_by ||
    d.created_by ||
    d.createdBy ||
    "";
  return String(key || "").trim();
}

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

    let admin: any;
    try {
      admin = await getSupabaseAdmin();
    } catch (e: any) {
      return {
        ok: false,
        ranking: [],
        totalLinhas: 0,
        error: e?.message || "SUPABASE_SERVICE_ROLE_KEY ausente",
      };
    }
    const empresaId = String(ctx.empresa_id);

    let total = 0;
    try {
      const { count: totalCount } = await admin
        .from("processos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      total = typeof totalCount === "number" ? totalCount : 0;
    } catch {
      total = 0;
    }

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

    // todas as linhas leves
    const pageSize = 1000;
    let offset = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await admin
        .from("processos")
        .select(
          "atendido_por, created_by, ultimo_retorno, datajud_encerrado_tribunal, status, situacao, dados"
        )
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
      if (offset > 30000) break;
    }

    const ref = new Date();
    const { start: weekStart, end: weekEnd } = weekBounds(ref);
    const hojeYmd = hojeBrasilYmd(ref);
    const [yy, mm] = hojeYmd.split("-").map((n) => parseInt(n, 10));
    const monthStart = startOfDay(new Date(yy, mm - 1, 1));
    const monthEnd = endOfDay(new Date(yy, mm, 0));

    const counts = new Map<string, { dia: number; semana: number; mes: number }>();
    let atendidosSemana = 0;
    let ativos = 0;

    for (const row of rows) {
      const status = String(row.status || row.situacao || "").toUpperCase();
      const enc =
        row.datajud_encerrado_tribunal === true ||
        /ENCERRAD|ARQUIVAD/.test(status);
      if (!enc) ativos += 1;

      const raw = pickRetorno(row);
      if (!raw) continue;
      const dt = parseUltimoAtendimento(raw);
      if (!dt) continue;

      const inWeek = isWithinInterval(dt, { start: weekStart, end: weekEnd });
      if (inWeek) atendidosSemana += 1;

      const userId = pickUserKey(row);
      if (!userId) continue;

      const entry = counts.get(userId) || { dia: 0, semana: 0, mes: 0 };
      if (isAtendidoHoje(raw, ref)) entry.dia += 1;
      if (inWeek) entry.semana += 1;
      if (isWithinInterval(dt, { start: monthStart, end: monthEnd })) entry.mes += 1;
      counts.set(userId, entry);
    }

    // se COUNT falhou, usa rows.length
    const totalFinal = total > 0 ? total : rows.length;
    // se ativos veio 0 e total grande, recalcula aproximado
    const ativosFinal = rows.length ? ativos : totalFinal;

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

    return {
      ok: true,
      ranking,
      totalLinhas: rows.length,
      total: totalFinal,
      ativos: ativosFinal,
      atendidosSemana,
    };
  } catch (e: any) {
    console.error("[fetchRankingAtendentesEmpresaAction]", e?.message);
    return { ok: false, ranking: [], totalLinhas: 0, error: e?.message };
  }
}
