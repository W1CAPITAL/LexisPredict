"use server";

/**
 * Top Atendentes e "Atendidos semana" = LOG de auditoria
 * (quem clicou Atender), único por pessoa + CNJ no período.
 * NÃO usa created_by. NÃO conta Trigger/W1 como operador humano.
 */

import {
  isAtendidoHoje,
  weekBounds,
  hojeBrasilYmd,
  parseUltimoAtendimento,
} from "@/lib/atendimento-semana";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";

export type RankRow = {
  userId: string;
  userNome: string;
  dia: number;
  semana: number;
  mes: number;
  subtitle?: string;
};

const SISTEMA_AUTH = "af1b75ea-cb64-4ebc-b4ad-ce1ce1fc01c5";
const SISTEMA_KEY = "sistema-interno";

function isSistemaNome(nome: string, auth: string) {
  const n = nome.toLowerCase();
  const a = auth.toLowerCase();
  if (a === SISTEMA_AUTH.toLowerCase() || a === SISTEMA_KEY) return true;
  return /sistema interno|w1 control|w1 controll|trigger db|^trigger$|^sistema$/.test(n);
}

function protoKey(p: string) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 10 ? d : String(p || "").trim().toUpperCase();
}

/** Data civil em Brasília a partir de ISO (não usar slice UTC — corta a semana). */
function ymdBrasilFromIso(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso || "").slice(0, 10);
  }
}

export async function fetchRankingAtendentesEmpresaAction(limit = 5): Promise<{
  ok: boolean;
  ranking: RankRow[];
  totalLinhas: number;
  total?: number;
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

    const ref = new Date();
    const { start: weekStart, end: weekEnd } = weekBounds(ref);
    const hojeYmd = hojeBrasilYmd(ref);
    const [yy, mm] = hojeYmd.split("-").map((n) => parseInt(n, 10));
    const monthStart = startOfDay(new Date(yy, mm - 1, 1));
    const monthEnd = endOfDay(new Date(yy, mm, 0));
    // Garante logs desde o início da semana (seg) mesmo no dia 1 do mês
    const fetchFrom = weekStart.getTime() < monthStart.getTime() ? weekStart : monthStart;

    // Logs da semana+mês. Pagina se preciso.
    const logs: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await admin
        .from("auditoria_logs_app")
        .select("auth_user_id, user_nome, protocolo_ref, action, created_at, detalhes")
        .eq("empresa_id", empresaId)
        .in("action", ["atendimento", "encerramento"])
        .gte("created_at", fetchFrom.toISOString())
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) {
        console.error("[ranking-audit]", error.message);
        break;
      }
      const chunk = data || [];
      logs.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
      if (offset > 20000) break;
    }

    type Acc = { dia: Set<string>; semana: Set<string>; mes: Set<string>; nome: string };
    const byUser = new Map<string, Acc>();
    const semanaEmpresa = new Set<string>();

    for (const row of logs) {
      const iso = String(row.created_at || "");
      const ymdBr = ymdBrasilFromIso(iso);
      const when = parseUltimoAtendimento(ymdBr);
      if (!when) continue;
      const proto = protoKey(row.protocolo_ref);
      if (!proto || proto === "SOLICITARONPROCESSO") continue;

      const auth = String(row.auth_user_id || "").trim().toLowerCase();
      let nome = String(row.user_nome || "").trim();
      if (auth && nameById[auth]) nome = nameById[auth];
      if (!nome) nome = auth ? nameById[auth] || "Operador" : "Operador";

      const sistema = isSistemaNome(nome, auth);
      const userKey = sistema ? SISTEMA_KEY : auth || nome.toLowerCase();
      const display = sistema ? "SISTEMA INTERNO" : nome;

      if (!byUser.has(userKey)) {
        byUser.set(userKey, { dia: new Set(), semana: new Set(), mes: new Set(), nome: display });
      }
      const acc = byUser.get(userKey)!;
      acc.nome = display;

      if (isWithinInterval(when, { start: monthStart, end: monthEnd })) acc.mes.add(proto);
      if (isWithinInterval(when, { start: weekStart, end: weekEnd })) {
        acc.semana.add(proto);
        if (!sistema) semanaEmpresa.add(proto);
      }
      if (isAtendidoHoje(ymdBr, ref)) acc.dia.add(proto);
    }

    const ranking: RankRow[] = [...byUser.entries()]
      .map(([userId, c]) => ({
        userId,
        userNome: c.nome,
        dia: c.dia.size,
        semana: c.semana.size,
        mes: c.mes.size,
        subtitle: userId === SISTEMA_KEY ? "Feito por Davi Alves Figueredo · W1 Control" : undefined,
      }))
      .filter((r) => r.semana > 0 || r.dia > 0 || r.mes > 0)
      .sort((a, b) => {
        // sistema vai no fim do top se empate de semana
        if (a.userId === SISTEMA_KEY && b.userId !== SISTEMA_KEY) return 1;
        if (b.userId === SISTEMA_KEY && a.userId !== SISTEMA_KEY) return -1;
        return b.semana - a.semana || b.dia - a.dia || b.mes - a.mes;
      })
      .slice(0, Math.max(8, limit));

    return {
      ok: true,
      ranking,
      totalLinhas: logs.length,
      total,
      atendidosSemana: semanaEmpresa.size,
    };
  } catch (e: any) {
    console.error("[fetchRankingAtendentesEmpresaAction]", e?.message);
    return { ok: false, ranking: [], totalLinhas: 0, error: e?.message };
  }
}
