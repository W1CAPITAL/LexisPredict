"use server";

/**
 * Métricas + ranking da EMPRESA INTEIRA (Processos da Empresa).
 * - total: COUNT no Postgres
 * - ativos: !isCasoEncerrado (status operacional da carteira — NÃO datajud_encerrado)
 * - atendidosSemana: ultimo_retorno na semana atual
 * - ranking: por atendido_por (legado: created_by) + nome em usuarios
 */

import {
  isAtendidoHoje,
  parseUltimoAtendimento,
  weekBounds,
  hojeBrasilYmd,
} from "@/lib/atendimento-semana";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

export type RankRow = {
  userId: string;
  userNome: string;
  dia: number;
  semana: number;
  mes: number;
};

function pickRetorno(row: any): string | null {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  const raw =
    row?.ultimo_retorno ??
    d.ultimoRetorno ??
    d.ultimo_retorno ??
    d.ULTIMO_RETORNO ??
    d.ultimoAtendimento ??
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
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

/** Shape mínimo para isCasoEncerrado */
function rowAsCase(row: any) {
  const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
  return {
    status: row?.status ?? d.status ?? null,
    situacao: row?.situacao ?? d.situacao ?? d.SITUACAO ?? null,
    statusManual: d.statusManual ?? null,
    dados: d,
    datajud_encerrado_tribunal: row?.datajud_encerrado_tribunal,
  };
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

    // COUNT total
    let total = 0;
    try {
      const { count } = await admin
        .from("processos")
        .select("*", { count: "exact", head: true })
        .eq("empresa_id", empresaId);
      total = typeof count === "number" ? count : 0;
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
    } catch (e: any) {
      console.error("[ranking] usuarios", e?.message);
    }

    // Linhas leves — SEM coluna situacao (pode não existir no schema)
    // Tenta com status; se falhar, só dados + flags
    const pageSize = 1000;
    let offset = 0;
    const rows: any[] = [];
    let selectCols =
      "atendido_por, created_by, ultimo_retorno, datajud_encerrado_tribunal, status, dados";

    for (;;) {
      let { data, error } = await admin
        .from("processos")
        .select(selectCols)
        .eq("empresa_id", empresaId)
        .range(offset, offset + pageSize - 1);

      if (error) {
        // fallback sem status
        console.error("[ranking] select", error.message);
        selectCols = "atendido_por, created_by, ultimo_retorno, dados";
        const retry = await admin
          .from("processos")
          .select(selectCols)
          .eq("empresa_id", empresaId)
          .range(offset, offset + pageSize - 1);
        if (retry.error) {
          console.error("[ranking] select fallback", retry.error.message);
          break;
        }
        data = retry.data;
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
    let encerrados = 0;

    for (const row of rows) {
      const c = rowAsCase(row);
      if (isCasoEncerrado(c)) {
        encerrados += 1;
      } else {
        ativos += 1;
      }

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

    const totalFinal = total > 0 ? total : rows.length;
    // Se a amostra bate com o total, ativos é confiável; senão escala pela proporção
    let ativosFinal = ativos;
    if (rows.length > 0 && totalFinal > rows.length) {
      // não deveria acontecer com paginação completa; mantém contagem da amostra
      ativosFinal = ativos;
    }
    // Nunca reportar ativos === total se vimos encerrados
    if (encerrados === 0 && ativos === rows.length && rows.length > 0) {
      // re-checa via dados.status no JSON (status coluna vazia)
      let ativos2 = 0;
      let enc2 = 0;
      for (const row of rows) {
        const d = row?.dados && typeof row.dados === "object" ? row.dados : {};
        const blob = `${row?.status || ""} ${d.status || ""} ${d.situacao || ""} ${d.SITUACAO || ""}`.toUpperCase();
        if (/ENCERRAD|ARQUIVAD|EXTINTO|SUSPENSO|IM[OÓ]VEL/.test(blob)) enc2 += 1;
        else ativos2 += 1;
      }
      if (enc2 > 0) {
        ativosFinal = ativos2;
        encerrados = enc2;
      }
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
      .slice(0, Math.max(1, limit));

    return {
      ok: true,
      ranking,
      totalLinhas: rows.length,
      total: totalFinal,
      ativos: ativosFinal,
      atendidosSemana,
      // debug leve (não quebra UI)
      // @ts-expect-error optional
      encerrados,
    };
  } catch (e: any) {
    console.error("[fetchRankingAtendentesEmpresaAction]", e?.message);
    return { ok: false, ranking: [], totalLinhas: 0, error: e?.message };
  }
}
